import { z } from "zod";

export * from "./recruitment-pipeline";

const isoDateTime = z.string().datetime();

export const applicationDocumentKindSchema = z.enum(["cv", "cover-letter"]);
export type ApplicationDocumentKind = z.infer<
  typeof applicationDocumentKindSchema
>;

export const documentMediaTypeSchema = z.enum([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const submittedCandidateSchema = z
  .object({
    applicationId: z.string().min(1).max(128),
    candidate: z
      .object({
        displayName: z.string().min(1).max(200),
        verifiedEmail: z.string().email().max(320),
        sharedPhone: z.string().max(32).nullable(),
        avatarUrl: z.string().url().nullable(),
      })
      .strict(),
    submittedAt: isoDateTime,
    stage: z.enum([
      "APPLIED",
      "VIEWED",
      "SHORTLISTED",
      "INTERVIEWING",
      "OFFERED",
      "HIRED",
      "OFFER_DECLINED",
      "REJECTED",
      "WAITLISTED",
    ]),
    cv: z
      .object({
        available: z.boolean(),
        mediaType: documentMediaTypeSchema,
        previewSupported: z.boolean(),
      })
      .strict(),
    coverLetter: z.union([
      z.object({ kind: z.literal("NONE") }).strict(),
      z
        .object({
          kind: z.enum(["TEXT", "PDF", "DOC", "DOCX"]),
          available: z.boolean(),
          previewSupported: z.boolean(),
        })
        .strict(),
    ]),
  })
  .strict();

export const applicationPageSchema = z
  .object({
    items: z.array(submittedCandidateSchema).max(100),
    nextCursor: z.string().min(1).max(512).nullable(),
  })
  .strict();

export const applicationSafeErrorSchema = z
  .object({
    code: z.enum([
      "INVALID_REQUEST",
      "UNAUTHENTICATED",
      "UNAVAILABLE",
      "PREVIEW_UNAVAILABLE",
      "DOCUMENT_UNAVAILABLE",
      "APPLICATION_CONFLICT",
    ]),
    message: z.string().min(1).max(200),
  })
  .strict();

export const applicationSubmissionOutcomeSchema = z
  .object({
    applicationId: z.string().min(1).max(128),
    jobId: z.string().min(1).max(128),
    stage: z.literal("APPLIED"),
    stageVersion: z.literal(1),
    submittedAt: isoDateTime,
    created: z.boolean(),
  })
  .strict();

export type SubmittedCandidate = z.infer<typeof submittedCandidateSchema>;
export type ApplicationPage = z.infer<typeof applicationPageSchema>;
export type ApplicationSafeError = z.infer<typeof applicationSafeErrorSchema>;
export type ApplicationSubmissionOutcome = z.infer<
  typeof applicationSubmissionOutcomeSchema
>;

export const applicationListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
