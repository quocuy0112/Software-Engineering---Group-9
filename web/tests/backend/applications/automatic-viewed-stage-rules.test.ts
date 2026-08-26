import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAutomaticScoreStageRuleForApplication,
  applyAutomaticViewedStageRules,
  applyAutomaticViewedStageRulesForAllApplications,
} from "@/backend/applications/services/automatic-viewed-stage-rules";

const now = new Date("2026-08-18T12:00:00.000Z");

function candidate(input: {
  id: string;
  stage: "APPLIED" | "VIEWED";
  finalScore?: number | null;
  aiScore?: number | null;
  changedAt?: Date;
  mediumThreshold?: number;
  highThreshold?: number;
}) {
  const resolvedFinalScore =
    input.finalScore === undefined
      ? (input.aiScore ?? null)
      : input.finalScore;
  const resolvedAiScore =
    input.aiScore === undefined ? resolvedFinalScore : input.aiScore;
  return {
    id: input.id,
    stage: input.stage,
    stageVersion: input.stage === "APPLIED" ? 1 : 2,
    lastStageChangedAt: input.changedAt ?? new Date("2026-08-16T12:00:00.000Z"),
    withdrawalOutcome: null,
    currentScoringResult: {
      state: "SCORED" as const,
      aiScore: resolvedAiScore,
      finalScore: resolvedFinalScore,
      mediumThreshold: input.mediumThreshold ?? 60,
      highThreshold: input.highThreshold ?? 80,
    },
  };
}

function unscoredCandidate(input: {
  id: string;
  stage: "APPLIED" | "VIEWED";
  state?: "DETERMINISTIC_ONLY" | "SCORED";
  changedAt?: Date;
}) {
  return {
    id: input.id,
    stage: input.stage,
    stageVersion: input.stage === "APPLIED" ? 1 : 2,
    lastStageChangedAt: input.changedAt ?? new Date("2026-08-16T12:00:00.000Z"),
    withdrawalOutcome: null,
    currentScoringResult: {
      state: input.state ?? ("DETERMINISTIC_ONLY" as const),
      aiScore: null,
      finalScore: null,
      mediumThreshold: 60,
      highThreshold: 80,
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
  it("waitlists a sub-60 Applied application immediately with the low-score reason", async () => {
    const db = database([
      candidate({ id: "low", stage: "APPLIED", finalScore: 59.9 }),
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
        targetStage: "WAITLISTED",
        actor: { kind: "system_auto_score" },
        reasonCode: "score_below_60_auto_waitlist",
      }),
    );
    expect(service.attemptStageTransition).not.toHaveBeenCalledWith(
      expect.objectContaining({
        candidateApplicationId: "low",
        targetStage: "REJECTED",
      }),
    );
  });

  it("does not add the low-score Waitlist entry condition at exactly 60", async () => {
    const db = database([
      candidate({ id: "threshold", stage: "APPLIED", finalScore: 60 }),
    ]);
    const service = stageService();

    await applyAutomaticScoreStageRuleForApplication({
      candidateApplicationId: "threshold",
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).not.toHaveBeenCalled();
  });

  it("does not reject a low AI score when the final score is high", async () => {
    const db = database([
      candidate({
        id: "strong-final",
        stage: "APPLIED",
        aiScore: 50,
        finalScore: 80,
      }),
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

  it("waitlists a low final score even when the AI score is high", async () => {
    const db = database([
      candidate({
        id: "low-final",
        stage: "APPLIED",
        aiScore: 95,
        finalScore: 59.9,
      }),
    ]);
    const service = stageService();

    await applyAutomaticScoreStageRuleForApplication({
      candidateApplicationId: "low-final",
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateApplicationId: "low-final",
        targetStage: "WAITLISTED",
        reasonCode: "score_below_60_auto_waitlist",
      }),
    );
  });

  it("waitlists a low score immediately if scoring completes after the application was viewed", async () => {
    const db = database([
      candidate({
        id: "low-viewed",
        stage: "VIEWED",
        finalScore: 59.9,
        changedAt: new Date("2026-08-18T11:59:00.000Z"),
      }),
    ]);
    const service = stageService();

    await applyAutomaticScoreStageRuleForApplication({
      candidateApplicationId: "low-viewed",
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateApplicationId: "low-viewed",
        targetStage: "WAITLISTED",
        reasonCode: "score_below_60_auto_waitlist",
      }),
    );
  });

  it.each([
    ["not-scored-applied", "APPLIED"],
    ["not-scored-viewed", "VIEWED"],
  ] as const)(
    "does not auto-transition %s when no final score has been published",
    async (id, stage) => {
      const db = database([unscoredCandidate({ id, stage })]);
      const service = stageService();

      await applyAutomaticScoreStageRuleForApplication({
        candidateApplicationId: id,
        db: db as never,
        stageService: service as never,
        now,
      });

      expect(service.attemptStageTransition).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["review-needed", 79.9, "REJECTED", "review_needed_timeout_auto_reject"],
    ["strong", 80, "SHORTLISTED", "strong_match_timeout_auto_shortlist"],
  ] as const)(
    "uses the timeout decision for %s candidates",
    async (id, finalScore, targetStage, reasonCode) => {
      const db = database([
        candidate({ id, stage: "VIEWED", finalScore }),
      ]);
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

  it("uses a 12-hour default Viewed timeout", async () => {
    const db = database([
      candidate({
        id: "timeout-not-reached",
        stage: "VIEWED",
        finalScore: 72,
        changedAt: new Date(now.getTime() - 12 * 60 * 60_000 + 1),
      }),
      candidate({
        id: "timeout-reached",
        stage: "VIEWED",
        finalScore: 72,
        changedAt: new Date(now.getTime() - 12 * 60 * 60_000),
      }),
    ]);
    const service = stageService();

    await applyAutomaticViewedStageRules({
      jobPostingId: "job-1",
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).toHaveBeenCalledTimes(1);
    expect(service.attemptStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateApplicationId: "timeout-reached",
        targetStage: "REJECTED",
        reasonCode: "review_needed_timeout_auto_reject",
      }),
    );
  });

  it("uses configured thresholds and leaves a manual-action candidate alone", async () => {
    vi.stubEnv("RECRUITMENT_AUTO_SCORE_LOW_THRESHOLD", "50");
    vi.stubEnv("RECRUITMENT_AUTO_SCORE_STRONG_THRESHOLD", "90");
    vi.stubEnv("RECRUITMENT_VIEWED_AUTO_DECISION_WINDOW_MINUTES", "30");
    const db = database([
      candidate({
        id: "configured-low",
        stage: "APPLIED",
        finalScore: 54,
        mediumThreshold: 50,
        highThreshold: 90,
      }),
      candidate({
        id: "manual-action",
        stage: "VIEWED",
        finalScore: 72,
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

  it("sweeps timed-out Viewed candidates without a job-page request", async () => {
    const db = database([
      candidate({
        id: "background-review-needed",
        stage: "VIEWED",
        finalScore: 79.9,
      }),
    ]);
    const service = stageService();

    await applyAutomaticViewedStageRulesForAllApplications({
      db: db as never,
      stageService: service as never,
      now,
    });

    expect(service.attemptStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateApplicationId: "background-review-needed",
        targetStage: "REJECTED",
        reasonCode: "review_needed_timeout_auto_reject",
        actor: { kind: "system_auto_score" },
      }),
    );
  });
});
