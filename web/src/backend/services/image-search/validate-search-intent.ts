import "server-only";

import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";
import type {
  RawIntentProposal,
  SearchIntentInterpreter,
} from "@/backend/image-search/interpretation/search-intent-interpreter";
import { searchIntentSchema } from "@/shared/contracts/jobs/search-intent";

export class ValidateSearchIntentService {
  constructor(
    private readonly dependencies: Readonly<{
      interpreter: SearchIntentInterpreter;
      selectionPolicy: SearchIntentSelectionPolicy;
    }>,
  ) {}

  async execute(input: {
    text: string;
    language: "VI" | "EN" | "BILINGUAL" | "UNKNOWN";
    deadline: Date;
    signal: AbortSignal;
    safetyIdentifier?: string;
  }) {
    const proposals: readonly RawIntentProposal[] =
      await this.dependencies.interpreter.interpret({
        text: input.text,
        language: input.language,
        purposeVersion: "job-image-search-purpose-v1",
        inputVersion: "search-ocr-text-v1",
        instructionVersion: "job-search-intent-v2",
        schemaVersion: "job-search-intent-v1",
        allowedFields: [
          "q",
          "location",
          "employmentType",
          "experienceLevel",
          "workArrangement",
          "skills",
          "salaryMin",
          "salaryMax",
          "salaryCurrency",
          "salaryPeriod",
          "postedWithinDays",
        ],
        safetyIdentifier: input.safetyIdentifier,
        deadline: input.deadline,
        signal: input.signal,
      });
    return searchIntentSchema.parse(
      this.dependencies.selectionPolicy.validateAndSelect({
        ocrText: input.text,
        language: input.language,
        proposals,
      }),
    );
  }
}
