const intEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const scoringProviderConfig = Object.freeze({
  timeoutMilliseconds: intEnv("SCORING_AI_TIMEOUT_MS", 15_000),
  maxAttempts: Math.min(3, intEnv("SCORING_AI_MAX_ATTEMPTS", 3)),
  circuitFailureThreshold: intEnv("SCORING_AI_CIRCUIT_FAILURE_THRESHOLD", 5),
  circuitResetMilliseconds: intEnv("SCORING_AI_CIRCUIT_RESET_MS", 60_000),
  modelVersion: process.env.SCORING_AI_MODEL_VERSION ?? "model-v1",
  promptVersion: process.env.SCORING_AI_PROMPT_VERSION ?? "prompt-v3",
  policyVersion: process.env.SCORING_AI_POLICY_VERSION ?? "sensitive-attributes-v1",
});

export function scoringProviderConfigurationProbe() {
  return { ...scoringProviderConfig, apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY) };
}
