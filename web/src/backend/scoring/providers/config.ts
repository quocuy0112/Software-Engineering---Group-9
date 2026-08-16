const intEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const boolEnv = (name: string) =>
  process.env[name]?.toLocaleLowerCase("en-US") === "true";

export const scoringProviderConfig = Object.freeze({
  timeoutMilliseconds: intEnv("SCORING_AI_TIMEOUT_MS", 15_000),
  maxAttempts: Math.min(3, intEnv("SCORING_AI_MAX_ATTEMPTS", 3)),
  circuitFailureThreshold: intEnv("SCORING_AI_CIRCUIT_FAILURE_THRESHOLD", 5),
  circuitResetMilliseconds: intEnv("SCORING_AI_CIRCUIT_RESET_MS", 60_000),
  modelVersion:
    process.env.SCORING_AI_MODEL_VERSION ??
    process.env.CV_OPENAI_MODEL ??
    "gpt-5.4-mini-2026-03-17",
  promptVersion:
    process.env.SCORING_AI_PROMPT_VERSION ?? "prompt-v5-ai-cv-assessment",
  policyVersion:
    process.env.SCORING_AI_POLICY_VERSION ?? "sensitive-attributes-v1",
  externalEnabled:
    process.env.SCORING_AI_ENABLED === undefined
      ? boolEnv("CV_OPENAI_ENABLED")
      : boolEnv("SCORING_AI_ENABLED"),
  privacyApproved:
    boolEnv("CV_OPENAI_DPA_APPROVED") &&
    boolEnv("CV_OPENAI_CROSS_BORDER_APPROVED") &&
    boolEnv("CV_OPENAI_ZDR_APPROVED"),
  localDevelopmentEnabled:
    process.env.APP_ENV === "local" && boolEnv("CV_OPENAI_LOCAL_DEV_ENABLED"),
});

export function scoringProviderConfigurationProbe() {
  return {
    ...scoringProviderConfig,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}
