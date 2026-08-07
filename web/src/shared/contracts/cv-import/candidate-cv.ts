import { z } from "zod";

const candidateCvIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);

export const candidateCvRenameRequestSchema = z
  .object({ displayName: z.string().trim().min(1).max(200) })
  .strict();

export const candidateCvSummarySchema = z
  .object({
    id: candidateCvIdSchema,
    displayName: z.string().min(1).max(200),
    fileName: z.string().min(1).max(255),
    mimeType: z.enum([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
    byteSize: z.number().int().min(1).max(5_000_000),
    version: z.number().int().positive(),
    confirmedAt: z.string().datetime(),
  })
  .strict();

export const candidateCvLibrarySchema = z
  .object({ items: z.array(candidateCvSummarySchema).max(50) })
  .strict();

export const candidateCvDeleteOutcomeSchema = z
  .object({
    id: candidateCvIdSchema,
    archivedAt: z.string().datetime(),
  })
  .strict();

export type CandidateCvSummary = z.infer<typeof candidateCvSummarySchema>;
export type CandidateCvLibrary = z.infer<typeof candidateCvLibrarySchema>;

export { candidateCvIdSchema };
