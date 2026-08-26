import { describe, expect, it, vi } from "vitest";
import { ScoringDetailService } from "@/backend/scoring/services/scoring-detail-service";
import { aiFixture, automaticFixture } from "./fixtures";

function database(stage: "APPLIED" | "VIEWED") {
  return {
    jobApplication: {
      findUnique: vi.fn().mockResolvedValue({
        id: "application-1",
        jobPostingId: "job-1",
        stage,
        stageVersion: stage === "APPLIED" ? 1 : 2,
        scoringStatus: "NOT_REQUESTED",
        scoringWorkItems: [],
        scoringOperations: [],
        jobPosting: { scoringOperations: [] },
      }),
    },
  };
}

describe("scoring detail review tracking", () => {
  it("marks an applied application viewed when an authorized recruiter opens scoring", async () => {
    const db = database("APPLIED");
    const authorization = {
      authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
    };
    const scoring = { findCurrent: vi.fn().mockResolvedValue(null) };
    const stageService = { transition: vi.fn().mockResolvedValue(undefined) };
    const service = new ScoringDetailService(
      db as never,
      authorization as never,
      scoring as never,
      stageService as never,
    );

    await service.get("recruiter-1", "application-1", "session-1");

    expect(stageService.transition).toHaveBeenCalledWith(
      { userId: "recruiter-1", sessionId: "session-1" },
      "application-1",
      { targetStage: "VIEWED", expectedVersion: 1 },
    );
  });

  it("does not transition an application that is already viewed", async () => {
    const db = database("VIEWED");
    const stageService = { transition: vi.fn() };
    const service = new ScoringDetailService(
      db as never,
      {
        authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
      } as never,
      { findCurrent: vi.fn().mockResolvedValue(null) } as never,
      stageService as never,
    );

    await service.get("recruiter-1", "application-1", "session-1");

    expect(stageService.transition).not.toHaveBeenCalled();
  });

  it("exposes an active candidate rescore while keeping the published score visible", async () => {
    const db = database("VIEWED");
    db.jobApplication.findUnique.mockResolvedValue({
      id: "application-1",
      jobPostingId: "job-1",
      stage: "VIEWED",
      stageVersion: 2,
      scoringStatus: "COMPLETED",
      scoringWorkItems: [],
      scoringOperations: [{ id: "rescore-1", kind: "JOB_RESCORE" }],
      jobPosting: { scoringOperations: [] },
    });
    const scoring = {
      findCurrent: vi.fn().mockResolvedValue({
        state: "SCORED",
        automatic: automaticFixture(),
        ai: aiFixture(),
        finalScore: {
          value: 89.6,
          formulaText: "92 × 40% + 88 × 60% = 89.6",
          formulaVersion: "HS-40/60-v1",
          automaticWeight: 0.4,
          aiWeight: 0.6,
          band: { code: "HIGH_MATCH", label: "Strong match", iconLabel: "✓" },
          cvVersion: "CV-v1",
          jdVersion: "JD-v3",
          configVersion: "HS-40/60-v1",
          computedAt: "2026-08-16T00:00:00.000Z",
        },
        rescoreInProgress: false,
      }),
    };
    const service = new ScoringDetailService(
      db as never,
      {
        authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
      } as never,
      scoring as never,
      { transition: vi.fn() } as never,
    );

    const result = await service.get("recruiter-1", "application-1");

    expect(result.rescoreInProgress).toBe(true);
    expect(result.scoring.kind).toBe("SCORED");
  });

  it("exposes a terminal scoring failure instead of not calculated", async () => {
    const db = database("VIEWED");
    db.jobApplication.findUnique.mockResolvedValue({
      id: "application-1",
      jobPostingId: "job-1",
      stage: "VIEWED",
      stageVersion: 2,
      scoringStatus: "FAILED",
      scoringWorkItems: [
        { lastSafeFailureCode: "CV_CLASSIFICATION_UNAVAILABLE" },
      ],
      scoringOperations: [],
      jobPosting: { scoringOperations: [] },
    });
    const service = new ScoringDetailService(
      db as never,
      {
        authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
      } as never,
      { findCurrent: vi.fn().mockResolvedValue(null) } as never,
      { transition: vi.fn() } as never,
    );

    const result = await service.get("recruiter-1", "application-1");

    expect(result.scoring).toEqual({
      kind: "FAILED",
      label: "Scoring failed",
      safeFailureCode: "CV_CLASSIFICATION_UNAVAILABLE",
      retryAllowed: true,
    });
  });
});
