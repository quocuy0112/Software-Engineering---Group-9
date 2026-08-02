import { z } from "zod";

import {
  canonicalJsonBytes,
  cvDraftIdSchema,
  cvUploadIdSchema,
  cvUtcTimestampSchema,
} from "./common";
import { cvConfirmationReceiptSchema } from "./upload";

export const CV_DRAFT_PAYLOAD_MAX_BYTES = 256 * 1024;
export const CV_PROVENANCE_PAYLOAD_MAX_BYTES = 128 * 1024;
// The PATCH document embeds immutable evidence beside editable proposals. Allow
// both independently capped documents plus a small, fixed JSON envelope.
export const CV_SAVE_DRAFT_REQUEST_MAX_BYTES =
  CV_DRAFT_PAYLOAD_MAX_BYTES + CV_PROVENANCE_PAYLOAD_MAX_BYTES + 4 * 1024;

const ownedIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
const revisionSchema = z.number().int().min(0);
const nullableText = (maximum: number) => z.string().max(maximum).nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

export const cvEvidenceSchema = z
  .object({
    confidence: z.number().min(0).max(1).nullable(),
    locations: z
      .array(z.string().min(1).max(100))
      .max(20)
      .refine((values) => new Set(values).size === values.length),
    contextAvailable: z.boolean(),
    context: z.string().max(500).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.contextAvailable !== Boolean(value.context))
      context.addIssue({
        code: "custom",
        message: "Context availability must be explicit.",
      });
  });

const scalarMaximum = {
  headline: 200,
  summary: 5_000,
  phone: 32,
  location: 160,
} as const;

const scalarProposalSchemas = Object.entries(scalarMaximum).map(
  ([field, maximum]) =>
    z
      .object({
        proposalId: ownedIdSchema,
        field: z.literal(field as keyof typeof scalarMaximum),
        value: z.string().min(1).max(maximum),
        evidence: cvEvidenceSchema,
      })
      .strict(),
);

export const cvScalarProposalSchema = z.union(
  scalarProposalSchemas as [
    (typeof scalarProposalSchemas)[number],
    (typeof scalarProposalSchemas)[number],
  ],
);

export const cvExperienceValueSchema = z
  .object({
    title: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    description: nullableText(3_000),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    isCurrent: z.boolean(),
  })
  .strict();

export const cvEducationValueSchema = z
  .object({
    institution: z.string().min(1).max(200),
    degree: z.string().min(1).max(200),
    field: nullableText(200),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    isCurrent: z.boolean(),
  })
  .strict();

function collectionProposal<T extends z.ZodType>(value: T) {
  return z
    .object({
      proposalId: ownedIdSchema,
      value,
      duplicateTargetIds: z
        .array(ownedIdSchema)
        .max(10)
        .refine((values) => new Set(values).size === values.length),
      evidence: cvEvidenceSchema,
    })
    .strict();
}

export const cvEditableProposalsSchema = z
  .object({
    scalars: z.array(cvScalarProposalSchema).max(4),
    experiences: z.array(collectionProposal(cvExperienceValueSchema)).max(50),
    education: z.array(collectionProposal(cvEducationValueSchema)).max(50),
    skills: z
      .array(
        z
          .object({
            proposalId: ownedIdSchema,
            value: z.string().min(1).max(80),
            duplicate: z.boolean(),
            evidence: cvEvidenceSchema,
          })
          .strict(),
      )
      .max(50),
    socialLinks: z
      .array(collectionProposal(z.string().min(8).max(2_048).url()))
      .max(10),
  })
  .strict();

const scalarDecisionSchema = z
  .object({
    proposalId: ownedIdSchema,
    action: z.enum(["ADD", "REPLACE", "SKIP"]),
  })
  .strict();
const entryDecisionSchema = z
  .object({
    proposalId: ownedIdSchema,
    action: z.enum(["ADD", "REPLACE", "SKIP"]),
    targetId: ownedIdSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.action === "REPLACE") !== Boolean(value.targetId))
      context.addIssue({
        code: "custom",
        message: "Only replacement decisions name a target.",
      });
  });
const skillDecisionSchema = z
  .object({ proposalId: ownedIdSchema, action: z.enum(["ADD", "SKIP"]) })
  .strict();

export const cvReviewDecisionsSchema = z
  .object({
    reviewComplete: z.boolean(),
    scalars: z.array(scalarDecisionSchema).max(4),
    experiences: z.array(entryDecisionSchema).max(50),
    education: z.array(entryDecisionSchema).max(50),
    skills: z.array(skillDecisionSchema).max(50),
    socialLinks: z.array(entryDecisionSchema).max(10),
  })
  .strict();

const profileExperienceSchema = cvExperienceValueSchema.extend({
  id: ownedIdSchema,
  position: z.number().int().min(0).max(49),
});
const profileEducationSchema = cvEducationValueSchema.extend({
  id: ownedIdSchema,
  position: z.number().int().min(0).max(49),
});

export const cvCandidateProfileSnapshotSchema = z
  .object({
    revision: revisionSchema,
    headline: nullableText(200),
    summary: nullableText(5_000),
    phone: nullableText(32),
    location: nullableText(160),
    experiences: z.array(profileExperienceSchema).max(50),
    education: z.array(profileEducationSchema).max(50),
    skills: z
      .array(
        z
          .object({
            id: ownedIdSchema,
            displayName: z.string().min(1).max(80),
            position: z.number().int().min(0).max(49),
          })
          .strict(),
      )
      .max(50),
    socialLinks: z
      .array(
        z
          .object({
            id: ownedIdSchema,
            url: z.string().url().max(2_048),
            position: z.number().int().min(0).max(9),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export const cvDraftComparisonSchema = z
  .object({
    draftId: cvDraftIdSchema,
    uploadId: cvUploadIdSchema,
    draftRevision: revisionSchema,
    sourceProfileRevision: revisionSchema,
    reviewedProfileRevision: revisionSchema,
    currentProfile: cvCandidateProfileSnapshotSchema,
    proposals: cvEditableProposalsSchema,
    reviewDecisions: cvReviewDecisionsSchema,
    expiresAt: cvUtcTimestampSchema,
  })
  .strict();

export const saveCvDraftRequestSchema = z
  .object({
    baseDraftRevision: revisionSchema,
    reviewedProfileRevision: revisionSchema,
    proposals: cvEditableProposalsSchema,
    reviewDecisions: cvReviewDecisionsSchema,
  })
  .strict();

export const saveCvDraftOutcomeSchema = z
  .object({
    draftId: cvDraftIdSchema,
    draftRevision: z.number().int().min(1),
    reviewedProfileRevision: revisionSchema,
    savedAt: cvUtcTimestampSchema,
  })
  .strict();

export const confirmCvDraftRequestSchema = z
  .object({
    draftRevision: revisionSchema,
    sourceProfileRevision: revisionSchema,
    reviewedProfileRevision: revisionSchema,
  })
  .strict();

export { cvConfirmationReceiptSchema };

export function assertCompleteReview(input: {
  proposals: z.infer<typeof cvEditableProposalsSchema>;
  decisions: z.infer<typeof cvReviewDecisionsSchema>;
}) {
  const groups = [
    "scalars",
    "experiences",
    "education",
    "skills",
    "socialLinks",
  ] as const;
  for (const group of groups) {
    const proposals = input.proposals[group]
      .map((proposal) => proposal.proposalId)
      .sort();
    const decisions = input.decisions[group]
      .map((decision) => decision.proposalId)
      .sort();
    if (
      new Set(decisions).size !== decisions.length ||
      proposals.join("\0") !== decisions.join("\0")
    )
      throw new Error("CV_REVIEW_DECISIONS_INCOMPLETE");
  }
}

export function assertReviewPayloadCaps(input: {
  proposals: unknown;
  decisions: unknown;
  provenance?: unknown;
}) {
  if (
    canonicalJsonBytes(input.proposals) + canonicalJsonBytes(input.decisions) >
    CV_DRAFT_PAYLOAD_MAX_BYTES
  )
    throw new RangeError("CV_DRAFT_PAYLOAD_LIMIT_EXCEEDED");
  if (
    input.provenance !== undefined &&
    canonicalJsonBytes(input.provenance) > CV_PROVENANCE_PAYLOAD_MAX_BYTES
  )
    throw new RangeError("CV_PROVENANCE_LIMIT_EXCEEDED");
}

export function splitCvReviewPayload(proposals: CvEditableProposals) {
  const groups = [
    "scalars",
    "experiences",
    "education",
    "skills",
    "socialLinks",
  ] as const;
  const editable = Object.fromEntries(
    groups.map((group) => [
      group,
      proposals[group].map((proposal) =>
        Object.fromEntries(
          Object.entries(proposal).filter(([key]) => key !== "evidence"),
        ),
      ),
    ]),
  );
  const provenance = Object.fromEntries(
    groups.flatMap((group) =>
      proposals[group].map((proposal) => [
        proposal.proposalId,
        proposal.evidence,
      ]),
    ),
  );
  return { editable, provenance } as const;
}

export type CvEditableProposals = z.infer<typeof cvEditableProposalsSchema>;
export type CvReviewDecisions = z.infer<typeof cvReviewDecisionsSchema>;
export type CvDraftComparison = z.infer<typeof cvDraftComparisonSchema>;
export type SaveCvDraftRequest = z.infer<typeof saveCvDraftRequestSchema>;
export type ConfirmCvDraftRequest = z.infer<typeof confirmCvDraftRequestSchema>;
