import { z } from "zod";

import { canonicalJsonBytes } from "./common";

export const CV_DRAFT_SCHEMA_VERSION = "cv-draft-v1" as const;
export const CV_DRAFT_V2_SCHEMA_VERSION = "cv-draft-v2" as const;
export const CV_DRAFT_MAX_BYTES = 256 * 1024;
export const CV_PROVENANCE_MAX_BYTES = 128 * 1024;

const confidenceSchema = z.number().min(0).max(1).nullable();
const sourceSegmentIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._:-]+$/u);
const sourceSegmentIdsSchema = z
  .array(sourceSegmentIdSchema)
  .max(20)
  .refine((values) => new Set(values).size === values.length, {
    message: "Source segment identifiers must be unique.",
  });
const isoDateSchema = z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u);

function scalarProposal(maximumLength: number) {
  return z
    .object({
      value: z.string().min(1).max(maximumLength),
      confidence: confidenceSchema,
      sourceSegmentIds: sourceSegmentIdsSchema,
    })
    .strict();
}

const evidenceSchema = {
  confidence: confidenceSchema,
  sourceSegmentIds: sourceSegmentIdsSchema,
};

export const cvExperienceProposalSchema = z
  .object({
    title: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    description: z.string().min(1).max(3000).nullable(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    isCurrent: z.boolean(),
    ...evidenceSchema,
  })
  .strict();

export const cvEducationProposalSchema = z
  .object({
    institution: z.string().min(1).max(200),
    degree: z.string().min(1).max(200),
    field: z.string().min(1).max(200).nullable(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    isCurrent: z.boolean(),
    ...evidenceSchema,
  })
  .strict();

export const cvSkillProposalSchema = z
  .object({
    name: z.string().min(1).max(80),
    ...evidenceSchema,
  })
  .strict();

export const cvSocialLinkProposalSchema = z
  .object({
    url: z
      .string()
      .min(8)
      .max(2048)
      .regex(/^https?:\/\//u),
    ...evidenceSchema,
  })
  .strict();

export const cvParserOutputSchema = z
  .object({
    schemaVersion: z.literal(CV_DRAFT_SCHEMA_VERSION),
    scalars: z
      .object({
        headline: scalarProposal(200).nullable(),
        summary: scalarProposal(5000).nullable(),
        phone: scalarProposal(32).nullable(),
        location: scalarProposal(160).nullable(),
      })
      .strict(),
    experiences: z.array(cvExperienceProposalSchema).max(50),
    education: z.array(cvEducationProposalSchema).max(50),
    skills: z.array(cvSkillProposalSchema).max(50),
    socialLinks: z.array(cvSocialLinkProposalSchema).max(10),
  })
  .strict();

export type CvParserOutput = z.infer<typeof cvParserOutputSchema>;

export const cvParserSegmentEvidenceSchema = z
  .object({
    segmentId: sourceSegmentIdSchema,
    sourceMethod: z.enum(["NATIVE", "OCR", "NATIVE_AND_OCR"]),
    sourceLocation: z.string().min(1).max(160),
    confidenceLevel: z.enum(["NATIVE", "HIGH", "REVIEW", "LOW"]),
    warnings: z
      .array(
        z.enum([
          "LOW_CONFIDENCE",
          "MATERIAL_NATIVE_OCR_CONFLICT",
          "APPROXIMATE_ANCHOR",
          "PARTIAL_UNIT_TEXT",
          "DEDUPLICATED_WITH_NATIVE",
        ]),
      )
      .max(8),
  })
  .strict();

export const cvParserOutputV2Schema = cvParserOutputSchema
  .omit({ schemaVersion: true })
  .extend({
    schemaVersion: z.literal(CV_DRAFT_V2_SCHEMA_VERSION),
    segmentEvidence: z.array(cvParserSegmentEvidenceSchema).max(10_000),
  })
  .strict();

export const cvParserAnyOutputSchema = z.union([
  cvParserOutputSchema,
  cvParserOutputV2Schema,
]);
export type CvParserOutputV2 = z.infer<typeof cvParserOutputV2Schema>;
export type CvParserAnyOutput = z.infer<typeof cvParserAnyOutputSchema>;

function evidenceIdentifiers(output: CvParserAnyOutput): string[] {
  const identifiers: string[] = [];
  for (const proposal of Object.values(output.scalars)) {
    if (proposal) identifiers.push(...proposal.sourceSegmentIds);
  }
  for (const proposal of [
    ...output.experiences,
    ...output.education,
    ...output.skills,
    ...output.socialLinks,
  ]) {
    identifiers.push(...proposal.sourceSegmentIds);
  }
  return identifiers;
}

export function validateParserEvidenceMembership(
  output: CvParserAnyOutput,
  availableSegmentIds: ReadonlySet<string>,
): boolean {
  return evidenceIdentifiers(output).every((id) => availableSegmentIds.has(id));
}

export function canonicalParserOutputBytes(output: CvParserAnyOutput): number {
  return canonicalJsonBytes(cvParserAnyOutputSchema.parse(output));
}

export function assertParserOutputWithinLimits(
  output: CvParserAnyOutput,
  provenance: unknown,
): void {
  if (canonicalParserOutputBytes(output) > CV_DRAFT_MAX_BYTES) {
    throw new RangeError("CV draft exceeds its canonical JSON byte limit.");
  }
  if (canonicalJsonBytes(provenance) > CV_PROVENANCE_MAX_BYTES) {
    throw new RangeError(
      "CV provenance exceeds its canonical JSON byte limit.",
    );
  }
}
