import type {
  AutomaticMatchingResult,
  ScoringInput,
} from "./scoring-contracts";

/**
 * Persistence-free deterministic matching boundary. It accepts only a
 * sanitized immutable scoring input and cannot publish to either pipeline.
 */
export type AutomaticMatchingPort = Readonly<{
  match(input: ScoringInput): Promise<AutomaticMatchingResult>;
}>;
