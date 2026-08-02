import "server-only";

import { prisma } from "@/backend/database/prisma";
import { CvImportServiceError } from "@/backend/services/cv-import/cv-http-errors";
import {
  canonicalJson,
  canonicalJsonBytes,
} from "@/shared/contracts/cv-import/common";
import {
  assertCompleteReview,
  assertReviewPayloadCaps,
  cvEditableProposalsSchema,
  cvReviewDecisionsSchema,
  splitCvReviewPayload,
  saveCvDraftOutcomeSchema,
  type CvEditableProposals,
  type CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";

function ids(value: unknown) {
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>)
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .map((proposal) =>
      proposal && typeof proposal === "object" && "proposalId" in proposal
        ? String(proposal.proposalId)
        : "",
    )
    .sort();
}

function validateDecisionSemantics(
  proposals: CvEditableProposals,
  decisions: CvReviewDecisions,
  profile: {
    headline: string | null;
    summary: string | null;
    phone: string | null;
    location: string | null;
    experienceIds: Set<string>;
    educationIds: Set<string>;
    socialLinkIds: Set<string>;
  },
  latest: {
    draftRevision: number;
    profileRevision: number;
    draftUpdatedAt: string;
    profileUpdatedAt: string;
  },
) {
  const scalarFields = new Map(
    proposals.scalars.map((proposal) => [proposal.proposalId, proposal.field]),
  );
  for (const decision of decisions.scalars) {
    if (decision.action === "SKIP") continue;
    const field = scalarFields.get(decision.proposalId);
    if (!field) throw new CvImportServiceError("VALIDATION_ERROR");
    const current = profile[field];
    if (
      (decision.action === "ADD" && current !== null) ||
      (decision.action === "REPLACE" && current === null)
    )
      throw new CvImportServiceError("VALIDATION_ERROR");
  }
  for (const [group, owned] of [
    [decisions.experiences, profile.experienceIds],
    [decisions.education, profile.educationIds],
    [decisions.socialLinks, profile.socialLinkIds],
  ] as const) {
    for (const decision of group)
      if (
        decision.action === "REPLACE" &&
        (!decision.targetId || !owned.has(decision.targetId))
      )
        throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
          latest,
        });
  }
}

export class PrismaCvDraftCommandRepository {
  async save(input: {
    accountId: string;
    draftId: string;
    baseDraftRevision: number;
    reviewedProfileRevision: number;
    proposals: CvEditableProposals;
    reviewDecisions: CvReviewDecisions;
    now: Date;
  }) {
    const proposalsResult = cvEditableProposalsSchema.safeParse(
      input.proposals,
    );
    const decisionsResult = cvReviewDecisionsSchema.safeParse(
      input.reviewDecisions,
    );
    if (!proposalsResult.success || !decisionsResult.success)
      throw new CvImportServiceError("VALIDATION_ERROR");
    const proposals = proposalsResult.data;
    const decisions = decisionsResult.data;
    try {
      assertCompleteReview({ proposals, decisions });
    } catch {
      throw new CvImportServiceError("VALIDATION_ERROR");
    }
    const separated = splitCvReviewPayload(proposals);
    try {
      assertReviewPayloadCaps({
        proposals: separated.editable,
        decisions,
        provenance: separated.provenance,
      });
    } catch (error) {
      if (error instanceof RangeError)
        throw new CvImportServiceError("PAYLOAD_TOO_LARGE");
      throw error;
    }
    return prisma.$transaction(async (transaction) => {
      const locations = await transaction.$queryRaw<
        Array<{ profileId: string; uploadId: string }>
      >`
        SELECT draft."profileId", draft."uploadId"
          FROM "CvDraft" draft
          JOIN "CandidateProfile" profile ON profile."id" = draft."profileId"
          JOIN "CvUpload" upload ON upload."id" = draft."uploadId"
          JOIN "user" account ON account."id" = draft."accountId"
         WHERE draft."id" = ${input.draftId}
           AND draft."accountId" = ${input.accountId}
           AND profile."candidateUserId" = ${input.accountId}
           AND upload."accountId" = ${input.accountId}
           AND upload."profileId" = draft."profileId"
           AND account."state" = 'ACTIVE'
           AND account."deletedAt" IS NULL
      `;
      const location = locations[0];
      if (!location) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");

      // Feature 002 Profile commands lock the parent Profile before touching
      // child rows. Draft save and confirmation use the same global order so a
      // direct Profile save cannot deadlock either CV command.
      const profiles = await transaction.$queryRaw<
        Array<{
          profileId: string;
          profileRevision: number;
          profileUpdatedAt: Date;
        }>
      >`
        SELECT profile."id" AS "profileId",
               profile."revision" AS "profileRevision",
               profile."updatedAt" AS "profileUpdatedAt"
          FROM "CandidateProfile" profile
         WHERE profile."id" = ${location.profileId}
           AND profile."candidateUserId" = ${input.accountId}
         FOR UPDATE OF profile
      `;
      const profileLock = profiles[0];
      if (!profileLock) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");

      const uploads = await transaction.$queryRaw<
        Array<{
          uploadStatus: string;
          uploadExpiresAt: Date;
          uploadContentInaccessibleAt: Date | null;
          uploadDeletedAt: Date | null;
        }>
      >`
        SELECT upload."status"::text AS "uploadStatus",
               upload."expiresAt" AS "uploadExpiresAt",
               upload."contentInaccessibleAt" AS "uploadContentInaccessibleAt",
               upload."deletedAt" AS "uploadDeletedAt"
          FROM "CvUpload" upload
         WHERE upload."id" = ${location.uploadId}
           AND upload."accountId" = ${input.accountId}
           AND upload."profileId" = ${location.profileId}
         FOR UPDATE OF upload
      `;
      const uploadLock = uploads[0];
      if (!uploadLock) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");

      const drafts = await transaction.$queryRaw<
        Array<{
          draftId: string;
          revision: number;
          draftUpdatedAt: Date;
          draftStatus: string;
          draftExpiresAt: Date;
          draftContentInaccessibleAt: Date | null;
        }>
      >`
        SELECT draft."id" AS "draftId", draft."revision",
               draft."updatedAt" AS "draftUpdatedAt",
               draft."status"::text AS "draftStatus",
               draft."expiresAt" AS "draftExpiresAt",
               draft."contentInaccessibleAt" AS "draftContentInaccessibleAt"
          FROM "CvDraft" draft
         WHERE draft."id" = ${input.draftId}
           AND draft."accountId" = ${input.accountId}
           AND draft."profileId" = ${location.profileId}
           AND draft."uploadId" = ${location.uploadId}
         FOR UPDATE OF draft
      `;
      const draftLock = drafts[0];
      if (!draftLock) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
      const lock = { ...profileLock, ...uploadLock, ...draftLock };
      const latest = {
        draftRevision: lock.revision,
        profileRevision: lock.profileRevision,
        draftUpdatedAt: lock.draftUpdatedAt.toISOString(),
        profileUpdatedAt: lock.profileUpdatedAt.toISOString(),
      };
      if (
        lock.draftStatus !== "EDITABLE" ||
        lock.draftContentInaccessibleAt !== null ||
        lock.draftExpiresAt <= input.now
      )
        throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
      if (
        lock.uploadStatus !== "REVIEW_READY" ||
        lock.uploadContentInaccessibleAt !== null ||
        lock.uploadDeletedAt !== null ||
        lock.uploadExpiresAt <= input.now
      )
        throw new CvImportServiceError("IMPORT_STATE_CONFLICT", {
          latest,
        });
      if (lock.revision !== input.baseDraftRevision)
        throw new CvImportServiceError("DRAFT_REVISION_CONFLICT", {
          latest,
        });
      if (lock.profileRevision !== input.reviewedProfileRevision)
        throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
          latest,
        });
      const draft = await transaction.cvDraft.findUnique({
        where: { id: input.draftId },
      });
      if (!draft || !draft.proposalPayload || !draft.provenancePayload)
        throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
      if (
        ids(draft.proposalPayload).join("\0") !==
        ids(separated.editable).join("\0")
      )
        throw new CvImportServiceError("VALIDATION_ERROR");
      if (
        canonicalJson(separated.provenance) !==
        canonicalJson(draft.provenancePayload)
      )
        throw new CvImportServiceError("VALIDATION_ERROR");
      try {
        assertReviewPayloadCaps({
          proposals: separated.editable,
          decisions,
          provenance: draft.provenancePayload,
        });
      } catch (error) {
        if (error instanceof RangeError)
          throw new CvImportServiceError("PAYLOAD_TOO_LARGE");
        throw error;
      }
      const [experiences, education, socialLinks, profile] = await Promise.all([
        transaction.profileExperience.findMany({
          where: { profileId: lock.profileId },
          select: { id: true },
        }),
        transaction.profileEducation.findMany({
          where: { profileId: lock.profileId },
          select: { id: true },
        }),
        transaction.socialLink.findMany({
          where: { profileId: lock.profileId },
          select: { id: true },
        }),
        transaction.candidateProfile.findUnique({
          where: { id: lock.profileId },
          select: {
            headline: true,
            summary: true,
            phone: true,
            location: true,
          },
        }),
      ]);
      if (!profile) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
      validateDecisionSemantics(
        proposals,
        decisions,
        {
          ...profile,
          experienceIds: new Set(experiences.map(({ id }) => id)),
          educationIds: new Set(education.map(({ id }) => id)),
          socialLinkIds: new Set(socialLinks.map(({ id }) => id)),
        },
        latest,
      );
      const storedProposals = separated.editable;
      const payloadBytes =
        canonicalJsonBytes(storedProposals) + canonicalJsonBytes(decisions);
      if (payloadBytes > 256 * 1024)
        throw new CvImportServiceError("PAYLOAD_TOO_LARGE");
      const changed = await transaction.cvDraft.updateMany({
        where: {
          id: input.draftId,
          accountId: input.accountId,
          status: "EDITABLE",
          revision: input.baseDraftRevision,
        },
        data: {
          proposalPayload: storedProposals,
          reviewPayload: decisions,
          reviewedProfileRevision: input.reviewedProfileRevision,
          payloadBytes,
          revision: { increment: 1 },
          updatedAt: input.now,
        },
      });
      if (changed.count !== 1)
        throw new CvImportServiceError("DRAFT_REVISION_CONFLICT", {
          latest,
        });
      return saveCvDraftOutcomeSchema.parse({
        draftId: input.draftId,
        draftRevision: input.baseDraftRevision + 1,
        reviewedProfileRevision: input.reviewedProfileRevision,
        savedAt: input.now.toISOString(),
      });
    });
  }
}
