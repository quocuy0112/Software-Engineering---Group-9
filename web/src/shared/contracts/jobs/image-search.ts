import { z } from "zod";

import {
  employmentTypeSchema,
  experienceLevelSchema,
  jobSortSchema,
  salaryPeriodSchema,
  workArrangementSchema,
} from "./discovery";
import { searchIntentSchema } from "./search-intent";

export const IMAGE_SEARCH_PURPOSE_VERSION =
  "job-image-search-purpose-v1" as const;
export const IMAGE_SEARCH_NOTICE_VERSION = "image-search-notice-v1" as const;
export const IMAGE_SEARCH_CONSENT_TEXT_VERSION =
  "image-search-consent-v1" as const;
export const IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION =
  "image-search-retention-v1" as const;
export const IMAGE_SEARCH_OPENAI_MODEL = "gpt-5.4-mini-2026-03-17" as const;

const queryIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,80}$/u);
const utcTimestampSchema = z.string().datetime({ offset: true });

export const searchConsentGrantSchema = z
  .object({
    provider: z.literal("openai"),
    model: z.literal(IMAGE_SEARCH_OPENAI_MODEL),
    purposeVersion: z.literal(IMAGE_SEARCH_PURPOSE_VERSION),
    noticeVersion: z.literal(IMAGE_SEARCH_NOTICE_VERSION),
    consentTextVersion: z.literal(IMAGE_SEARCH_CONSENT_TEXT_VERSION),
    retentionDisclosureVersion: z.literal(
      IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION,
    ),
  })
  .strict();

export const createImageSearchRequestSchema = z
  .object({
    extension: z.enum(["png", "jpg", "jpeg"]),
    mediaType: z.enum(["image/png", "image/jpeg"]),
    bytes: z.number().int().min(1).max(5_000_000),
    interpreterClass: z.enum(["DETERMINISTIC_INTERNAL", "EXTERNAL_OPENAI"]),
    consent: searchConsentGrantSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const expected = value.extension === "png" ? "image/png" : "image/jpeg";
    if (value.mediaType !== expected)
      context.addIssue({
        code: "custom",
        path: ["mediaType"],
        message: "Extension and media type must agree.",
      });
    if (
      (value.interpreterClass === "EXTERNAL_OPENAI") !==
      Boolean(value.consent)
    )
      context.addIssue({
        code: "custom",
        path: ["consent"],
        message: "External interpretation requires explicit exact consent.",
      });
  });

export const createImageSearchResponseSchema = z
  .object({
    queryId: queryIdSchema,
    actorClass: z.enum(["VISITOR", "AUTHENTICATED"]),
    capability: z.string().min(43).max(128).nullable(),
    status: z.literal("AWAITING_CONTENT"),
    admittedAt: utcTimestampSchema,
    expiresAt: utcTimestampSchema,
    upload: z
      .object({
        method: z.literal("PUT"),
        path: z
          .string()
          .regex(
            /^\/api\/jobs\/image-searches\/[A-Za-z0-9_-]{10,80}\/content$/u,
          ),
        mediaType: z.enum(["image/png", "image/jpeg"]),
        bytes: z.number().int().min(1).max(5_000_000),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.actorClass === "VISITOR") !== Boolean(value.capability))
      context.addIssue({
        code: "custom",
        message: "Invalid capability projection",
      });
    if (!value.upload.path.includes(`/${value.queryId}/`))
      context.addIssue({
        code: "custom",
        message: "Upload path does not match query",
      });
  });

export const searchImageStatusSchema = z.enum([
  "AWAITING_CONTENT",
  "SCAN_QUEUED",
  "SCANNING",
  "DECODE_QUEUED",
  "DECODING",
  "OCR_QUEUED",
  "OCR_PROCESSING",
  "AWAITING_CONSENT",
  "INTERPRET_QUEUED",
  "INTERPRETING",
  "RESULT_READY",
  "FALLBACK_READY",
  "VALIDATION_FAILED",
  "INFECTED",
  "SCAN_FAILED",
  "DECODE_FAILED",
  "OCR_FAILED",
  "INTERPRET_FAILED",
  "CONSUMED",
  "CANCELLED",
  "EXPIRED",
  "DELETED",
]);

export const imageSearchFailureCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "MALWARE_DETECTED",
  "SCANNER_UNAVAILABLE",
  "SCANNER_DEFINITIONS_STALE",
  "UNSUPPORTED_IMAGE",
  "IMAGE_LIMIT_EXCEEDED",
  "IMAGE_DECODE_FAILED",
  "OCR_UNAVAILABLE",
  "OCR_LOW_CONFIDENCE",
  "OCR_OUTPUT_TOO_LARGE",
  "CONSENT_REQUIRED",
  "INTERPRETER_UNAVAILABLE",
  "INTERPRETER_INVALID_OUTPUT",
  "QUERY_EXPIRED",
]);

export const imageSearchStatusResponseSchema = z
  .object({
    queryId: queryIdSchema,
    state: searchImageStatusSchema,
    stage: z.enum([
      "UPLOAD",
      "SCAN",
      "DECODE",
      "OCR",
      "CONSENT",
      "INTERPRET",
      "RESULT",
      "TERMINAL",
    ]),
    availableActions: z
      .array(
        z.enum([
          "UPLOAD_CONTENT",
          "GRANT_CONSENT",
          "REVOKE_CONSENT",
          "CONSUME_RESULT",
          "CANCEL",
        ]),
      )
      .max(5)
      .refine((values) => new Set(values).size === values.length),
    admittedAt: utcTimestampSchema,
    expiresAt: utcTimestampSchema,
    retryAt: utcTimestampSchema.nullable(),
    failureCode: imageSearchFailureCodeSchema.nullable(),
  })
  .strict();

export const searchConsentRequestSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("GRANTED"), grant: searchConsentGrantSchema })
    .strict(),
  z.object({ action: z.literal("REVOKED"), grant: z.null() }).strict(),
]);

export const searchConsentResponseSchema = z
  .object({
    action: z.enum(["GRANTED", "REVOKED"]),
    occurredAt: utcTimestampSchema,
    state: searchImageStatusSchema,
  })
  .strict();

const uniqueArray = <T extends z.ZodType>(schema: T, maximum: number) =>
  z
    .array(schema)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length);

export const manualSearchContextSchema = z
  .object({
    q: z.string().trim().max(200),
    location: z.string().trim().max(160),
    employmentType: uniqueArray(employmentTypeSchema, 5),
    experienceLevel: uniqueArray(experienceLevelSchema, 6),
    workArrangement: uniqueArray(workArrangementSchema, 3),
    skills: uniqueArray(z.string().trim().min(1).max(80), 20),
    salaryMin: z.number().finite().min(0).nullable(),
    salaryMax: z.number().finite().min(0).nullable(),
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/u),
    salaryPeriod: salaryPeriodSchema,
    postedWithinDays: z
      .union([
        z.literal(1),
        z.literal(3),
        z.literal(7),
        z.literal(14),
        z.literal(30),
      ])
      .nullable(),
    sort: jobSortSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.salaryMin === null ||
      value.salaryMax === null ||
      value.salaryMin <= value.salaryMax,
    { path: ["salaryMax"], message: "Invalid salary range" },
  );

export const consumeImageSearchResultRequestSchema = z
  .object({ currentCriteria: manualSearchContextSchema })
  .strict();

export const validatedIntentResultSchema = z
  .object({
    kind: z.literal("VALIDATED_INTENT"),
    queryId: queryIdSchema,
    intent: searchIntentSchema,
  })
  .strict();

export const ocrFallbackResultSchema = z
  .object({
    kind: z.literal("OCR_TEXT_FALLBACK"),
    queryId: queryIdSchema,
    text: z.string().min(1).max(32_768),
    language: z.enum(["VI", "EN", "BILINGUAL", "UNKNOWN"]),
    warnings: uniqueArray(
      z.enum([
        "LOW_CONFIDENCE",
        "INTERPRETER_UNAVAILABLE",
        "INTERPRETER_INVALID_OUTPUT",
      ]),
      10,
    ),
  })
  .strict();

export const imageSearchResultSchema = z.discriminatedUnion("kind", [
  validatedIntentResultSchema,
  ocrFallbackResultSchema,
]);

export const imageSearchApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "FORBIDDEN",
  "CSRF_REJECTED",
  "IMAGE_SEARCH_NOT_FOUND",
  "IDEMPOTENCY_KEY_REUSED",
  "QUERY_STATE_CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "IMAGE_QUERY_RATE_LIMITED",
  "CONSENT_REQUIRED",
  "RESULT_NOT_READY",
  "RESULT_ALREADY_CONSUMED",
  "QUERY_EXPIRED",
  "IMAGE_PROCESSING_UNAVAILABLE",
]);

export const imageSearchApiErrorSchema = z
  .object({
    error: z
      .object({
        code: imageSearchApiErrorCodeSchema,
        message: z.string().min(1).max(300),
        requestId: z.string().min(1).max(100),
        retryAt: utcTimestampSchema.nullable(),
        fieldErrors: z
          .array(
            z
              .object({
                path: z.string().min(1).max(120),
                code: z.string().min(1).max(80),
                message: z.string().min(1).max(240),
              })
              .strict(),
          )
          .max(20),
      })
      .strict(),
  })
  .strict();

export type CreateImageSearchRequest = z.infer<
  typeof createImageSearchRequestSchema
>;
export type ManualSearchContext = z.infer<typeof manualSearchContextSchema>;
export type ImageSearchResult = z.infer<typeof imageSearchResultSchema>;
