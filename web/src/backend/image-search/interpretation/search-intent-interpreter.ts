import "server-only";

import { z } from "zod";

import { IMAGE_SEARCH_ALLOWED_FIELDS } from "@/shared/contracts/jobs/search-intent";

export const rawIntentProposalSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/u),
    field: z.enum(IMAGE_SEARCH_ALLOWED_FIELDS),
    stringValue: z.string().max(200).nullable(),
    numberValue: z.number().finite().min(0).max(1_000_000_000_000).nullable(),
    stringValues: z.array(z.string().min(1).max(80)).max(20),
    confidence: z.number().finite().min(0).max(1),
    basis: z.enum(["EXPLICIT", "NORMALIZED", "INFERRED"]),
    evidence: z
      .array(
        z
          .object({
            startCodePoint: z.number().int().min(0).max(32_768),
            endCodePoint: z.number().int().min(1).max(32_768),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

export type RawIntentProposal = z.infer<typeof rawIntentProposalSchema>;

export type SearchIntentInterpretRequest = Readonly<{
  text: string;
  language: "VI" | "EN" | "BILINGUAL" | "UNKNOWN";
  purposeVersion: "job-image-search-purpose-v1";
  inputVersion: "search-ocr-text-v1";
  instructionVersion: "job-search-intent-v1";
  schemaVersion: "job-search-intent-v1";
  allowedFields: typeof IMAGE_SEARCH_ALLOWED_FIELDS;
  safetyIdentifier?: string;
  deadline: Date;
  signal: AbortSignal;
}>;

export interface SearchIntentInterpreter {
  readonly interpreterClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
  interpret(
    input: SearchIntentInterpretRequest,
  ): Promise<readonly RawIntentProposal[]>;
}
