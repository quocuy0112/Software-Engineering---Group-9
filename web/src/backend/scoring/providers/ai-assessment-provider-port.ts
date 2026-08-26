import type { AiAssessment } from "@/shared/contracts/scoring";
import type { CvPreflightIssue } from "../domain/cv-preflight";

export type AiAssessmentProviderInput = Readonly<{
  applicationId: string;
  cvVersion: string;
  jdVersion: string;
  configVersion: string;
  automaticScore: number;
  evidence: ReadonlyArray<{ title: string; excerpt: string }>;
  jobTitle?: string;
  requiredSkills?: readonly string[];
  preferredSkills?: readonly string[];
  keyRequirements?: readonly string[];
  minimumExperienceYears?: number | null;
  requiredLanguages?: readonly string[];
  cvText?: string;
  coverLetterText?: string;
  preflightIssues?: readonly CvPreflightIssue[];
}>;

export type AiProviderFailureCode =
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

export class AiAssessmentProviderError extends Error {
  constructor(
    readonly code: AiProviderFailureCode,
    readonly transient = false,
    readonly diagnostic?: string,
  ) {
    super(code);
  }
}

export type AiAssessmentProviderPort = Readonly<{
  assess(input: AiAssessmentProviderInput): Promise<AiAssessment>;
}>;
