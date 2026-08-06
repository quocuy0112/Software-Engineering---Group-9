import { z } from "zod";

export const SEARCH_INTENT_SCHEMA_VERSION = "job-search-intent-v1" as const;
export const SEARCH_INTENT_SELECTION_POLICY_VERSION =
  "search-intent-selection-v1" as const;
export const IMAGE_SEARCH_ALLOWED_FIELDS = [
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
] as const;

const numericFields = new Set(["salaryMin", "salaryMax", "postedWithinDays"]);
const setFields = new Set([
  "employmentType",
  "experienceLevel",
  "workArrangement",
  "skills",
]);

export const searchIntentProposalSchema = z
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
            text: z.string().min(1).max(120),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    selected: z.boolean(),
    selectionReason: z.enum([
      "AUTO_EXPLICIT",
      "AUTO_NORMALIZED",
      "USER_SELECTION_REQUIRED",
      "MANUAL_VALUE_CONFLICT",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.stringValues).size !== value.stringValues.length) {
      context.addIssue({ code: "custom", message: "Values must be unique" });
    }
    const validCarrier = numericFields.has(value.field)
      ? value.numberValue !== null &&
        value.stringValue === null &&
        value.stringValues.length === 0
      : setFields.has(value.field)
        ? value.numberValue === null &&
          value.stringValue === null &&
          value.stringValues.length > 0
        : value.stringValue !== null &&
          value.stringValue.length > 0 &&
          value.numberValue === null &&
          value.stringValues.length === 0;
    if (!validCarrier) {
      context.addIssue({ code: "custom", message: "Invalid value carrier" });
    }
    if (
      value.evidence.some(
        ({ startCodePoint, endCodePoint }) => endCodePoint <= startCodePoint,
      )
    ) {
      context.addIssue({ code: "custom", message: "Invalid evidence range" });
    }
    if (
      value.selected &&
      (value.confidence < 0.9 ||
        value.basis === "INFERRED" ||
        !["AUTO_EXPLICIT", "AUTO_NORMALIZED"].includes(value.selectionReason))
    ) {
      context.addIssue({
        code: "custom",
        message: "Unsafe automatic selection",
      });
    }
  });

export const searchIntentSchema = z
  .object({
    schemaVersion: z.literal(SEARCH_INTENT_SCHEMA_VERSION),
    language: z.enum(["VI", "EN", "BILINGUAL", "UNKNOWN"]),
    proposals: z.array(searchIntentProposalSchema).max(20),
    warnings: z
      .array(
        z.enum([
          "CONTRADICTORY_CRITERIA_REMOVED",
          "EXCESS_CRITERIA_REMOVED",
          "LOW_CONFIDENCE_CRITERIA_REMOVED",
          "MANUAL_VALUE_PRESERVED",
          "UNSUPPORTED_CRITERIA_REMOVED",
          "UNVERIFIED_EVIDENCE_REMOVED",
        ]),
      )
      .max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.warnings).size !== value.warnings.length) {
      context.addIssue({ code: "custom", message: "Warnings must be unique" });
    }
  });

export type AllowedImageSearchField =
  (typeof IMAGE_SEARCH_ALLOWED_FIELDS)[number];
export type SearchIntent = z.infer<typeof searchIntentSchema>;
