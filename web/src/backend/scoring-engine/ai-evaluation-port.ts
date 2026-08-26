import type { AiEvaluationResult, ScoringInput } from "./scoring-contracts";

export type AiEvaluationFailureCode =
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_NOT_CONFIGURED"
  | "AI_PROVIDER_AUTHENTICATION"
  | "AI_PROVIDER_INVALID_REQUEST"
  | "AI_PROVIDER_MODEL_NOT_FOUND"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_POLICY_NOT_APPROVED"
  | "AI_PROVIDER_MALFORMED"
  | "AI_PROVIDER_CIRCUIT_OPEN"
  | "AI_PROVIDER_RETRY_EXHAUSTED";

export type AiEvaluationPort = Readonly<{
  evaluate(input: ScoringInput): Promise<AiEvaluationResult>;
}>;

export function isAiEvaluationFailureCode(
  value: unknown,
): value is AiEvaluationFailureCode {
  return (
    typeof value === "string" &&
    value.startsWith("AI_PROVIDER_")
  );
}
