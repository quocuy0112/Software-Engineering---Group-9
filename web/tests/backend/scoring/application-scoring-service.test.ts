import { describe, expect, it, vi } from "vitest";
import type { ScoringOperation } from "@/shared/contracts/scoring";
import { ApplicationScoringService } from "@/backend/scoring/services/application-scoring-service";
import type { prisma } from "@/backend/database/prisma";
import type { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import type { PrismaScoringRepository } from "@/backend/scoring/repositories/prisma-scoring-repository";

const operation: ScoringOperation = {
  operationId: "operation-1",
  kind: "INITIAL",
  state: "QUEUED",
  totalCount: 0,
  succeededCount: 0,
  deterministicOnlyCount: 0,
  failedCount: 0,
  requestedAt: "2026-08-16T00:00:00.000Z",
  completedAt: null,
};

function makeDb(consent = true) {
  return {
    jobApplication: {
      findUnique: vi.fn().mockResolvedValue({
        id: "application-1",
        jobPostingId: "job-1",
        candidateUserId: "candidate-1",
        aiAnalysisConsent: consent,
        documentDeletedAt: null,
        jobPosting: { version: 4 },
      }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    scoringOperation: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    scoringWorkItem: {
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

function makeScoring(current: unknown = null) {
  return {
    findCurrent: vi.fn().mockResolvedValue(current),
    createOperation: vi.fn().mockResolvedValue(operation),
    findOperation: vi.fn().mockResolvedValue({ ...operation, totalCount: 1 }),
  };
}

const authorization = {
  authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
};

describe("ApplicationScoringService", () => {
  it("queues one initial work item for the requested application", async () => {
    const db = makeDb();
    const scoring = makeScoring();
    const service = new ApplicationScoringService(
      db as unknown as typeof prisma,
      authorization as unknown as RecruiterApplicationAuthorization,
      scoring as unknown as PrismaScoringRepository,
    );

    const result = await service.request({
      userId: "recruiter-1",
      sessionId: "session-1",
      applicationId: "application-1",
      idempotencyKey: "score-application-1",
      raw: { confirmed: true },
    });

    expect(result.totalCount).toBe(1);
    expect(scoring.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "INITIAL",
        jobPostingId: "job-1",
        jobApplicationId: "application-1",
        targetJobDescriptionVersionId: "job-job-1-v4",
      }),
    );
    expect(db.scoringWorkItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          operationId: "operation-1",
          jobApplicationId: "application-1",
        },
      }),
    );
    expect(db.jobApplication.update).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: { scoringStatus: "PROCESSING" },
    });
  });

  it("reuses the deterministic result for a single-candidate AI retry", async () => {
    const db = makeDb();
    const scoring = makeScoring({
      state: "DETERMINISTIC_ONLY",
      automatic: {
        resultId: "automatic-1",
        jdVersion: "jd-v4",
        configVersion: "hybrid-60-40-v1",
      },
    });
    const aiRetryOperation = { ...operation, kind: "AI_RETRY" as const };
    scoring.createOperation.mockResolvedValue(aiRetryOperation);
    scoring.findOperation.mockResolvedValue({
      ...aiRetryOperation,
      totalCount: 1,
    });
    const service = new ApplicationScoringService(
      db as unknown as typeof prisma,
      authorization as unknown as RecruiterApplicationAuthorization,
      scoring as unknown as PrismaScoringRepository,
    );

    await service.request({
      userId: "recruiter-1",
      sessionId: "session-1",
      applicationId: "application-1",
      idempotencyKey: "score-application-2",
      raw: { confirmed: true },
    });

    expect(scoring.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "AI_RETRY",
        reusedAutomaticMatchResultId: "automatic-1",
        targetJobDescriptionVersionId: "jd-v4",
      }),
    );
    expect(db.jobApplication.update).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: { scoringStatus: "PENDING" },
    });
  });

  it("keeps a completed score visible while queuing a candidate rescore", async () => {
    const db = makeDb();
    const scoring = makeScoring({
      state: "SCORED",
      automatic: {
        resultId: "automatic-1",
        jdVersion: "jd-v4",
        configVersion: "hybrid-60-40-v1",
      },
    });
    const rescoreOperation = { ...operation, kind: "JOB_RESCORE" as const };
    scoring.createOperation.mockResolvedValue(rescoreOperation);
    scoring.findOperation.mockResolvedValue({
      ...rescoreOperation,
      totalCount: 1,
    });
    const service = new ApplicationScoringService(
      db as unknown as typeof prisma,
      authorization as unknown as RecruiterApplicationAuthorization,
      scoring as unknown as PrismaScoringRepository,
    );

    await service.request({
      userId: "recruiter-1",
      sessionId: "session-1",
      applicationId: "application-1",
      idempotencyKey: "score-application-rescore-1",
      raw: { confirmed: true },
    });

    expect(db.jobApplication.update).not.toHaveBeenCalled();
  });

  it("does not queue scoring without candidate consent", async () => {
    const db = makeDb(false);
    const scoring = makeScoring();
    const service = new ApplicationScoringService(
      db as unknown as typeof prisma,
      authorization as unknown as RecruiterApplicationAuthorization,
      scoring as unknown as PrismaScoringRepository,
    );

    await expect(
      service.request({
        userId: "recruiter-1",
        sessionId: "session-1",
        applicationId: "application-1",
        idempotencyKey: "score-application-3",
        raw: { confirmed: true },
      }),
    ).rejects.toThrow("AI_ANALYSIS_CONSENT_REQUIRED");
    expect(scoring.createOperation).not.toHaveBeenCalled();
  });
});
