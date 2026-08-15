import type { AiAssessment } from "@/shared/contracts/scoring";

export type AiAssessmentProviderInput = Readonly<{
  applicationId: string;
  cvVersion: string;
  jdVersion: string;
  configVersion: string;
  automaticScore: number;
  evidence: ReadonlyArray<{ title: string; excerpt: string }>;
}>;

export type AiProviderFailureCode =
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_MALFORMED"
  | "AI_PROVIDER_CIRCUIT_OPEN"
  | "AI_PROVIDER_RETRY_EXHAUSTED";

export class AiAssessmentProviderError extends Error {
  constructor(readonly code: AiProviderFailureCode, readonly transient = false) {
    super(code);
  }
}

export type AiAssessmentProviderPort = Readonly<{
  assess(input: AiAssessmentProviderInput): Promise<AiAssessment>;
}>;
