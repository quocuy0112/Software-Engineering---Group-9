import { z } from "zod";

const previewText = (maximum: number) => z.string().max(maximum);

export const documentQualityNoteSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(160),
    evidence: z.string().min(1).max(500),
    severity: z.enum(["MINOR", "HIGH"]),
    bucket: z.enum(["input_limitation", "extraction_uncertainty"]),
  })
  .strict();

const experienceSchema = z
  .object({
    role: previewText(200),
    company: previewText(200).nullable(),
    dates: previewText(80).nullable(),
    bullets: z.array(previewText(500)).max(20),
  })
  .strict();

const educationSchema = z
  .object({
    institution: previewText(200),
    degree: previewText(200).nullable(),
    dates: previewText(80).nullable(),
  })
  .strict();

export const structuredCvPreviewSchema = z
  .object({
    kind: z.literal("cv"),
    name: previewText(200).nullable(),
    title: previewText(200).nullable(),
    contact: z.array(previewText(160)).max(10),
    summary: previewText(5_000).nullable(),
    experience: z.array(experienceSchema).max(50),
    education: z.array(educationSchema).max(50),
    skills: z.array(previewText(80)).max(50),
    certifications: z.array(previewText(200)).max(30),
    languages: z.array(previewText(120)).max(30),
    qualityNotes: z.array(documentQualityNoteSchema).max(20),
  })
  .strict();

export const structuredCoverLetterPreviewSchema = z
  .object({
    kind: z.literal("cover-letter"),
    date: previewText(100).nullable(),
    greeting: previewText(300).nullable(),
    paragraphs: z.array(previewText(2_000)).max(30),
    closing: previewText(160).nullable(),
    signOff: previewText(200).nullable(),
    qualityNotes: z.array(documentQualityNoteSchema).max(20),
  })
  .strict();

export const structuredDocumentPreviewSchema = z
  .object({
    kind: z.enum(["cv", "cover-letter"]),
    /** A file can remain available when extracting its text is not possible. */
    previewStatus: z.enum(["PARSED", "LIMITED"]).default("PARSED"),
    fileName: previewText(255).nullable(),
    mediaType: previewText(120).nullable(),
    pageCount: z.number().int().positive().nullable(),
    parserVersion: z.string().min(1).max(80),
    processingMilliseconds: z.number().int().min(0).max(120_000),
    cacheHit: z.boolean(),
    content: z.discriminatedUnion("kind", [
      structuredCvPreviewSchema,
      structuredCoverLetterPreviewSchema,
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind !== value.content.kind) {
      context.addIssue({
        code: "custom",
        path: ["content", "kind"],
        message: "Document content kind must match the document kind.",
      });
    }
  });

export type DocumentQualityNote = z.infer<typeof documentQualityNoteSchema>;
export type StructuredCvPreview = z.infer<typeof structuredCvPreviewSchema>;
export type StructuredCoverLetterPreview = z.infer<
  typeof structuredCoverLetterPreviewSchema
>;
export type StructuredDocumentPreview = z.infer<
  typeof structuredDocumentPreviewSchema
>;
