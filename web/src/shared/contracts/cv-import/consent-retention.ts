import { z } from "zod";

import { cvUploadIdSchema, cvUtcTimestampSchema } from "./common";

export const CV_EXTERNAL_PROVIDER = "openai" as const;
export const CV_EXTERNAL_PROVIDER_CLASS = "EXTERNAL_OPENAI" as const;
export const CV_EXTERNAL_PROVIDER_DISPLAY_NAME = "OpenAI" as const;
export const CV_EXTERNAL_PURPOSE_VERSION =
  "cv-profile-fact-extraction-v1" as const;
export const CV_EXTERNAL_CONSENT_TEXT_VERSION =
  "cv-external-consent.v1" as const;
export const CV_EXTERNAL_PROCESSING_PURPOSE =
  "Create a private CV review draft by extracting professional facts" as const;
export const CV_EXTERNAL_CONSENT_NOTICE_TEXT =
  "I agree that SmartHire may send only this CV's extracted text to the approved OpenAI deployment solely to create a private review draft. The draft will not change my Candidate Profile until I explicitly confirm selected changes. I can revoke consent for future requests, but revocation cannot recall processing already transmitted to OpenAI." as const;

export const CV_CANDIDATE_DELETE_RETENTION_MS = 24 * 60 * 60_000;
export const CV_UNCONFIRMED_RETENTION_MS = 30 * 24 * 60 * 60_000;
export const CV_CONFIRMED_RETENTION_MS = 7 * 24 * 60 * 60_000;

export const cvExternalProcessingBindingSchema = z
  .object({
    uploadId: cvUploadIdSchema,
    providerClass: z.literal(CV_EXTERNAL_PROVIDER_CLASS),
    provider: z.literal(CV_EXTERNAL_PROVIDER),
    model: z.string().min(1).max(200),
    purposeVersion: z.literal(CV_EXTERNAL_PURPOSE_VERSION),
    noticeVersion: z.string().min(1).max(100),
    consentTextVersion: z.literal(CV_EXTERNAL_CONSENT_TEXT_VERSION),
  })
  .strict();

export const cvConsentChallengeSchema = z
  .string()
  .min(32)
  .max(2048)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);

export const cvConsentNoticeSchema = z
  .object({
    required: z.boolean(),
    granted: z.boolean(),
    providerDisplayName: z.string().min(1).max(100),
    processingPurpose: z.string().min(1).max(300),
    noticeText: z.string().min(1).max(5000),
    consentChallenge: cvConsentChallengeSchema,
  })
  .strict();

// Deliberately contains no provider, model, purpose, notice-version, or owner
// fields. The signed challenge selects the reviewed server binding.
export const cvConsentGrantRequestSchema = z
  .object({
    accepted: z.literal(true),
    consentChallenge: cvConsentChallengeSchema,
  })
  .strict();

export const cvConsentOutcomeSchema = z
  .object({
    uploadId: cvUploadIdSchema,
    grantedAt: cvUtcTimestampSchema,
    status: z.enum(["PARSE_QUEUED", "PARSE_FAILED"]),
  })
  .strict();

export const cvDeletionOutcomeSchema = z
  .object({
    uploadId: cvUploadIdSchema,
    status: z.enum(["CANCELLED", "DELETED"]),
    contentInaccessibleAt: cvUtcTimestampSchema,
    deleteAfter: cvUtcTimestampSchema,
    deletedAt: cvUtcTimestampSchema.nullable(),
    statusUrl: z
      .string()
      .regex(/^\/api\/account\/cv-imports\/[A-Za-z0-9_-]+$/u),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "DELETED" && value.deletedAt === null) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "Deleted imports require completed cleanup evidence.",
      });
    }
    if (value.status === "CANCELLED" && value.deletedAt !== null) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "Cancelled imports are still awaiting cleanup.",
      });
    }
  });

export const cvRetentionProjectionSchema = z
  .object({
    expiresAt: cvUtcTimestampSchema,
    contentInaccessibleAt: cvUtcTimestampSchema.nullable(),
    deleteAfter: cvUtcTimestampSchema.nullable(),
    deletedAt: cvUtcTimestampSchema.nullable(),
  })
  .strict();

export type CvExternalProcessingBinding = z.infer<
  typeof cvExternalProcessingBindingSchema
>;
export type CvConsentGrantRequest = z.infer<typeof cvConsentGrantRequestSchema>;
export type CvConsentNotice = z.infer<typeof cvConsentNoticeSchema>;
export type CvConsentOutcome = z.infer<typeof cvConsentOutcomeSchema>;
export type CvDeletionOutcome = z.infer<typeof cvDeletionOutcomeSchema>;
