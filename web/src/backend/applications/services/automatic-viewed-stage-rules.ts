import "server-only";

import { prisma } from "@/backend/database/prisma";
import {
  ApplicationStageService,
  type StageTransitionActor,
} from "@/backend/services/jobs/application-stage-service";
import type { StageTransitionOutcome } from "@/shared/contracts/applications";
import {
  automaticScoreBand,
  automaticScoreConfigForPublishedResult,
  automaticScoreStageReasonCodes,
  getAutomaticScoreStageRuleConfig,
  lowScoreAutomaticRejectReasonCode,
  type AutomaticScoreStageRuleConfig,
} from "./automatic-score-stage-config";

type ScoredApplication = Readonly<{
  id: string;
  stage: "APPLIED" | "VIEWED";
  stageVersion: number;
  lastStageChangedAt: Date;
  withdrawalOutcome: string | null;
  currentScoringResult: {
    aiScore: unknown;
    finalScore: unknown;
    mediumThreshold: unknown;
    highThreshold: unknown;
  } | null;
}>;

const actor: StageTransitionActor = { kind: "system_auto_score" };

function decimalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return Number.NaN;
  }
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return Number(value.toNumber());
  }
  return Number(value);
}

function configForCandidate(
  candidate: ScoredApplication,
  fallback = getAutomaticScoreStageRuleConfig(),
) {
  return automaticScoreConfigForPublishedResult({
    mediumThreshold: candidate.currentScoringResult?.mediumThreshold,
    highThreshold: candidate.currentScoringResult?.highThreshold,
    fallback,
  });
}

function viewedCutoff(now: Date, config: AutomaticScoreStageRuleConfig) {
  return new Date(now.getTime() - config.viewedTimeoutMinutes * 60_000);
}

function timedOut(
  candidate: ScoredApplication,
  now: Date,
  config: AutomaticScoreStageRuleConfig,
) {
  return candidate.lastStageChangedAt <= viewedCutoff(now, config);
}

function automaticDecision(input: {
  candidate: ScoredApplication;
  matchScore: number;
  config: AutomaticScoreStageRuleConfig;
  timeout: boolean;
}) {
  const { matchScore, config, timeout, candidate } = input;
  if (candidate.stage === "APPLIED") {
    if (matchScore >= config.lowScoreThreshold) return null;
    return {
      targetStage: "REJECTED" as const,
      reasonCode: lowScoreAutomaticRejectReasonCode(config),
      candidateVisibleReason:
        "Your application was not selected because its Smart Match score was below the configured threshold.",
    };
  }

  if (!timeout) return null;
  if (matchScore >= config.strongScoreThreshold) {
    return {
      targetStage: "SHORTLISTED" as const,
      reasonCode:
        automaticScoreStageReasonCodes.strongMatchTimeoutAutoShortlist,
      candidateVisibleReason:
        "Your application has been shortlisted because no manual decision was recorded during the review window.",
    };
  }
  return {
    targetStage: "REJECTED" as const,
    reasonCode:
      matchScore < config.lowScoreThreshold
        ? lowScoreAutomaticRejectReasonCode(config)
        : automaticScoreStageReasonCodes.reviewNeededTimeoutAutoReject,
    candidateVisibleReason:
      matchScore < config.lowScoreThreshold
        ? "Your application was not selected because its Smart Match score was below the configured threshold."
        : "Your application was not selected because no manual decision was recorded during the review window.",
  };
}

async function applyDecision(input: {
  candidate: ScoredApplication;
  now: Date;
  stageService: ApplicationStageService;
  config: AutomaticScoreStageRuleConfig;
  timeout: boolean;
}) {
  // Stage automation must use the published score recruiters see. Falling
  // back to the AI-only value keeps deterministic-only/legacy rows compatible
  // without allowing a low AI sub-score to reject a strong final match.
  const matchScore = decimalNumber(
    input.candidate.currentScoringResult?.finalScore ??
      input.candidate.currentScoringResult?.aiScore,
  );
  if (!Number.isFinite(matchScore)) return null;
  const decision = automaticDecision({
    candidate: input.candidate,
    matchScore,
    config: input.config,
    timeout: input.timeout,
  });
  if (!decision) return null;

  try {
    return await input.stageService.attemptStageTransition({
      candidateApplicationId: input.candidate.id,
      targetStage: decision.targetStage,
      actor,
      expectedStageVersion: input.candidate.stageVersion,
      reasonCode: decision.reasonCode,
      candidateVisibleReason: decision.candidateVisibleReason,
      source: "AUTOMATIC_SCORE_RULE",
      now: input.now,
    });
  } catch {
    // A recruiter, another scoring publication, or another automatic worker
    // may have won the compare-and-set. The stage service remains authoritative.
    return null;
  }
}

function applicationSelection() {
  return {
    id: true,
    stage: true,
    stageVersion: true,
    lastStageChangedAt: true,
    withdrawalOutcome: true,
    currentScoringResult: {
      select: {
        aiScore: true,
        finalScore: true,
        mediumThreshold: true,
        highThreshold: true,
      },
    },
  } as const;
}

/**
 * Applies all score-driven decisions for one job. Low-score applications are
 * checked while still APPLIED; stale VIEWED applications use the same
 * centralized transition service with the tier-specific timeout decision.
 */
export async function applyAutomaticViewedStageRules(input: {
  jobPostingId: string;
  now?: Date;
  stageService?: ApplicationStageService;
  db?: typeof prisma;
}) {
  const now = input.now ?? new Date();
  const db = input.db ?? prisma;
  const stageService = input.stageService ?? new ApplicationStageService(db);
  const config = getAutomaticScoreStageRuleConfig();
  const candidates = (await db.jobApplication.findMany({
    where: {
      jobPostingId: input.jobPostingId,
      withdrawalOutcome: null,
      stage: { in: ["APPLIED", "VIEWED"] },
    },
    select: applicationSelection(),
    orderBy: [{ lastStageChangedAt: "asc" }, { id: "asc" }],
    take: 500,
  })) as unknown as ScoredApplication[];

  const results: StageTransitionOutcome[] = [];
  for (const candidate of candidates) {
    if (candidate.withdrawalOutcome) continue;
    const candidateConfig = configForCandidate(candidate, config);
    const result = await applyDecision({
      candidate,
      now,
      stageService,
      config: candidateConfig,
      timeout:
        candidate.stage === "VIEWED" &&
        timedOut(candidate, now, candidateConfig),
    });
    if (result) results.push(result);
  }
  return results;
}

/**
 * Called immediately after a published AI result. This is deliberately
 * application-scoped so a low score cannot wait for a board read or a CV open.
 */
export async function applyAutomaticScoreStageRuleForApplication(input: {
  candidateApplicationId: string;
  now?: Date;
  stageService?: ApplicationStageService;
  db?: typeof prisma;
}) {
  const now = input.now ?? new Date();
  const db = input.db ?? prisma;
  const stageService = input.stageService ?? new ApplicationStageService(db);
  const row = await db.jobApplication.findUnique({
    where: { id: input.candidateApplicationId },
    select: {
      ...applicationSelection(),
      jobPostingId: true,
    },
  });
  if (!row || row.withdrawalOutcome) return null;
  const candidate = row as unknown as ScoredApplication;
  const config = configForCandidate(candidate);
  const result = await applyDecision({
    candidate,
    now,
    stageService,
    config,
    timeout: candidate.stage === "VIEWED" && timedOut(candidate, now, config),
  });
  return result;
}

const defaultConfig = getAutomaticScoreStageRuleConfig();
/** Backwards-compatible read-only snapshot for callers that display defaults. */
export const automaticViewedStageRuleConfig = Object.freeze({
  lowScoreThreshold: defaultConfig.lowScoreThreshold,
  strongScoreThreshold: defaultConfig.strongScoreThreshold,
  scoreThreshold: defaultConfig.strongScoreThreshold,
  defaultWindowMinutes: defaultConfig.viewedTimeoutMinutes,
});

export { automaticScoreBand };
