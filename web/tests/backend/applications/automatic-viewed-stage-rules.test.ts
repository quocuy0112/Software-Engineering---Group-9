import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAutomaticScoreStageRuleForApplication,
  applyAutomaticViewedStageRules,
} from "@/backend/applications/services/automatic-viewed-stage-rules";

const now = new Date("2026-08-18T12:00:00.000Z");

function candidate(input: {
  id: string;
  stage: "APPLIED" | "VIEWED";
  score: number;
  finalScore?: number | null;
  changedAt?: Date;
  mediumThreshold?: number;
  highThreshold?: number;
}) {
  return {
    id: input.id,
    stage: input.stage,
    stageVersion: input.stage === "APPLIED" ? 1 : 2,
    lastStageChangedAt: input.changedAt ?? new Date("2026-08-16T12:00:00.000Z"),
    withdrawalOutcome: null,
    currentScoringResult: {
      aiScore: input.score,
      finalScore: input.finalScore ?? null,
      mediumThreshold: input.mediumThreshold ?? 60,
      highThreshold: input.highThreshold ?? 80,
    },
  };
}

function stageService() {
  return {
    attemptStageTransition: vi.fn().mockImplementation(async (input) => ({
      applicationId: input.candidateApplicationId,
      fromStage: "VIEWED",
      stage: input.targetStage,
      stageVersion: 3,
      lastStageChangedAt: now.toISOString(),
      stageEventId: `${input.candidateApplicationId}-event`,
      replayed: false,
      allowedDestinations: [],
    })),
  };
}

function database(rows: unknown[]) {
  return {
    jobApplication: {
      findMany: vi.fn().mockResolvedValue(rows),
      findUnique: vi.fn().mockResolvedValue(rows[0] ?? null),
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("automatic score stage rules", () => {
  it("rejects a sub-60 Applied application immediately with the low-score reason", async () => {
    const db = database([
      candidate({ id: "low", stage: "APPLIED", score: 59.9 }),
    ]);
    const service = stageService();

    await applyAutomaticScoreStageRuleForApplication({
      candidateApplicationId: "low",
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateApplicationId: "low",
        targetStage: "REJECTED",
        actor: { kind: "system_auto_score" },
        reasonCode: "score_below_60_auto_reject",
      }),
    );
  });

  it("does not reject a strong final match because the AI-only sub-score is low", async () => {
    const db = database([
      candidate({ id: "strong-final", stage: "APPLIED", score: 50, finalScore: 80 }),
    ]);
    const service = stageService();

    await applyAutomaticScoreStageRuleForApplication({
      candidateApplicationId: "strong-final",
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).not.toHaveBeenCalled();
  });

  it.each([
    ["review-needed", 79.9, "REJECTED", "review_needed_timeout_auto_reject"],
    ["strong", 80, "SHORTLISTED", "strong_match_timeout_auto_shortlist"],
  ] as const)(
    "uses the timeout decision for %s candidates",
    async (id, score, targetStage, reasonCode) => {
      const db = database([candidate({ id, stage: "VIEWED", score })]);
      const service = stageService();

      await applyAutomaticViewedStageRules({
        jobPostingId: "job-1",
        db: db as never,
        stageService: service as never,
        now,
      });

      expect(service.attemptStageTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateApplicationId: id,
          targetStage,
          reasonCode,
          actor: { kind: "system_auto_score" },
        }),
      );
    },
  );

  it("uses configured thresholds and leaves a manual-action candidate alone", async () => {
    vi.stubEnv("RECRUITMENT_AUTO_SCORE_LOW_THRESHOLD", "50");
    vi.stubEnv("RECRUITMENT_AUTO_SCORE_STRONG_THRESHOLD", "90");
    vi.stubEnv("RECRUITMENT_VIEWED_AUTO_DECISION_WINDOW_MINUTES", "30");
    const db = database([
      candidate({
        id: "configured-low",
        stage: "APPLIED",
        score: 54,
        mediumThreshold: 50,
        highThreshold: 90,
      }),
      candidate({
        id: "manual-action",
        stage: "VIEWED",
        score: 72,
        changedAt: new Date("2026-08-18T11:45:00.000Z"),
      }),
    ]);
    const service = stageService();

    await applyAutomaticViewedStageRules({
      jobPostingId: "job-1",
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).not.toHaveBeenCalledWith(
      expect.objectContaining({ candidateApplicationId: "configured-low" }),
    );
    expect(service.attemptStageTransition).not.toHaveBeenCalledWith(
      expect.objectContaining({ candidateApplicationId: "manual-action" }),
    );
  });
});
