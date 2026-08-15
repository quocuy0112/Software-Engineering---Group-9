import { aiAssessmentSchema, type AiAssessment } from "@/shared/contracts/scoring";
import {
  AiAssessmentProviderError,
  type AiAssessmentProviderInput,
  type AiAssessmentProviderPort,
} from "./ai-assessment-provider-port";
import { scoringProviderConfig } from "./config";

type Transport = (input: AiAssessmentProviderInput) => Promise<unknown>;

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export class ApprovedAiAssessmentAdapter implements AiAssessmentProviderPort {
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(private readonly transport: Transport = async () => {
    throw new AiAssessmentProviderError("AI_PROVIDER_UNAVAILABLE", true);
  }) {}

  async assess(input: AiAssessmentProviderInput): Promise<AiAssessment> {
    if (this.circuitOpenedAt !== null && Date.now() - this.circuitOpenedAt < scoringProviderConfig.circuitResetMilliseconds) {
      throw new AiAssessmentProviderError("AI_PROVIDER_CIRCUIT_OPEN", true);
    }
    for (let attempt = 1; attempt <= scoringProviderConfig.maxAttempts; attempt++) {
      try {
        const raw = await Promise.race([
          this.transport(redactProviderInput(input)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new AiAssessmentProviderError("AI_PROVIDER_TIMEOUT", true)), scoringProviderConfig.timeoutMilliseconds)),
        ]);
        const parsed = aiAssessmentSchema.safeParse(raw);
        if (!parsed.success) throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED");
        this.consecutiveFailures = 0;
        this.circuitOpenedAt = null;
        return parsed.data;
      } catch (error) {
        const providerError = error instanceof AiAssessmentProviderError
          ? error
          : new AiAssessmentProviderError("AI_PROVIDER_UNAVAILABLE", true);
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= scoringProviderConfig.circuitFailureThreshold) this.circuitOpenedAt = Date.now();
        const canRetry = providerError.transient && attempt < scoringProviderConfig.maxAttempts;
        if (!canRetry) {
          if (attempt > 1 && providerError.transient) throw new AiAssessmentProviderError("AI_PROVIDER_RETRY_EXHAUSTED", true);
          throw providerError;
        }
        await sleep(Math.min(500 * 2 ** (attempt - 1), 2_000));
      }
    }
    throw new AiAssessmentProviderError("AI_PROVIDER_RETRY_EXHAUSTED", true);
  }
}

function redactProviderInput(input: AiAssessmentProviderInput): AiAssessmentProviderInput {
  return {
    ...input,
    evidence: input.evidence.map((item) => ({
      ...item,
      excerpt: item.excerpt
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email redacted]")
        .replace(/(?:\+?\d[\d ()-]{7,}\d)/gu, "[phone redacted]"),
    })),
  };
}
