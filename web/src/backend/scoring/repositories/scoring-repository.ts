import type {
  AiAssessment,
  AutomaticMatch,
  FinalScore,
  ManualPriority,
  ScoringOperation,
  ScoringState,
} from "@/shared/contracts/scoring";

export type PublishedScoringRecord = Readonly<{
  resultId: string;
  generation: number;
  state: "DETERMINISTIC_ONLY" | "SCORED";
  automatic: AutomaticMatch;
  ai: AiAssessment | null;
  finalScore: FinalScore | null;
  operationId: string;
  consecutiveFailures: number;
  rescoreInProgress: boolean;
}>;

export type ScoringRepositoryPort = Readonly<{
  findCurrent(applicationId: string): Promise<PublishedScoringRecord | null>;
  createOperation(input: {
    kind: "INITIAL" | "JOB_RESCORE" | "AI_RETRY";
    jobPostingId: string;
    jobApplicationId?: string;
    requestedByUserId: string;
    requestedAt: Date;
    idempotencyKey: string;
    confirmationIntent: boolean;
    targetJobDescriptionVersionId: string;
    targetScoringConfigVersionId: string;
    reusedAutomaticMatchResultId?: string;
  }): Promise<ScoringOperation>;
  findOperation(operationId: string): Promise<ScoringOperation | null>;
  publish(input: {
    applicationId: string;
    operationId: string;
    automatic: AutomaticMatch;
    ai: AiAssessment | null;
    finalScore: FinalScore | null;
    consecutiveFailures?: number;
  }): Promise<PublishedScoringRecord>;
  setPriority(input: {
    applicationId: string;
    value: ManualPriority["value"];
    reason: string;
    actorUserId: string;
    now: Date;
    expectedVersion: number;
  }): Promise<ManualPriority>;
  removePriority(input: {
    applicationId: string;
    reason: string;
    actorUserId: string;
    now: Date;
    expectedVersion: number;
  }): Promise<void>;
}>;

export function scoringStateFromPublished(record: PublishedScoringRecord | null): ScoringState {
  if (!record) return { kind: "NOT_CALCULATED", label: "Not calculated" };
  if (record.state === "SCORED" && record.ai && record.finalScore) {
    return {
      kind: "SCORED",
      label: "Scored",
      automaticMatch: record.automatic,
      aiAssessment: record.ai,
      finalScore: record.finalScore,
    };
  }
  return {
    kind: "UNAVAILABLE",
    label: "Unavailable",
    automaticMatch: record.automatic,
    aiAssessment: {
      kind: "UNAVAILABLE",
      label: "Unavailable",
      safeFailureCode: "AI_PROVIDER_UNAVAILABLE",
      supportGuidance: record.consecutiveFailures >= 3
        ? "Repeated AI failure — try later or contact support."
        : null,
    },
    finalScore: { kind: "NOT_CALCULATED", label: "Not calculated" },
    retryAllowed: true,
    consecutiveFailures: Math.max(1, record.consecutiveFailures),
  };
}
