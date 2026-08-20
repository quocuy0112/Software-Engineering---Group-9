import { z } from "zod";
import { isoDateTime } from ".";

export const exportFormatSchema = z.enum(["CSV", "XLSX"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportRequestStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "EXPIRED",
]);
export type ExportRequestStatus = z.infer<typeof exportRequestStatusSchema>;

export const createExportRequestSchema = z
  .object({ format: exportFormatSchema })
  .strict();

export const exportStatusSchema = z
  .object({
    id: z.string().min(1),
    jobId: z.string().min(1),
    format: exportFormatSchema,
    status: exportRequestStatusSchema,
    requestedAt: isoDateTime,
    dataCutoff: isoDateTime,
    completedAt: isoDateTime.nullable(),
    expiresAt: isoDateTime.nullable(),
    rowCount: z.number().int().nonnegative().nullable(),
    failureCode: z.string().nullable(),
    downloadAvailable: z.boolean(),
  })
  .strict();
export type ExportStatus = z.infer<typeof exportStatusSchema>;

export const exportScoreAvailabilitySchema = z.enum([
  "AVAILABLE",
  "UNAVAILABLE",
]);
export type ExportScoreAvailability = z.infer<
  typeof exportScoreAvailabilitySchema
>;

export const candidateExportHeaders = [
  "Application ID",
  "Candidate Name",
  "Email",
  "Phone",
  "Application Status",
  "CV Screening Score",
  "Score Availability",
  "Submitted At",
] as const;

export const candidateExportRowSchema = z
  .object({
    applicationId: z.string().min(1),
    candidateName: z.string(),
    email: z.string(),
    phone: z.string(),
    applicationStatus: z.string(),
    cvScreeningScore: z.string(),
    scoreAvailability: exportScoreAvailabilitySchema,
    submittedAt: isoDateTime,
  })
  .strict();
export type CandidateExportRow = z.infer<typeof candidateExportRowSchema>;

export const exportErrorSchema = z
  .object({ code: z.string(), message: z.string() })
  .strict();
