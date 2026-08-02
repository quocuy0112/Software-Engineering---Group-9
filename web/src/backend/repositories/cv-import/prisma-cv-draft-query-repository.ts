import "server-only";

import { prisma } from "@/backend/database/prisma";
import {
  cvDraftComparisonSchema,
  cvEditableProposalsSchema,
  cvReviewDecisionsSchema,
  type CvEditableProposals,
  type CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";

type StoredProposalGroup = Record<
  keyof CvEditableProposals,
  Array<Record<string, unknown> & { proposalId: string }>
>;

function date(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function hydrateProvenance(
  stored: unknown,
  provenance: unknown,
): CvEditableProposals {
  if (!stored || typeof stored !== "object")
    throw new Error("CV_DRAFT_PAYLOAD_UNAVAILABLE");
  const groups = stored as StoredProposalGroup;
  const evidence =
    provenance && typeof provenance === "object"
      ? (provenance as Record<string, unknown>)
      : {};
  return cvEditableProposalsSchema.parse(
    Object.fromEntries(
      Object.entries(groups).map(([group, proposals]) => [
        group,
        proposals.map((proposal) => ({
          ...proposal,
          evidence:
            evidence[proposal.proposalId] ??
            ({
              confidence: null,
              locations: [],
              contextAvailable: false,
              context: null,
            } as const),
        })),
      ]),
    ),
  );
}

function defaultDecisions(proposals: CvEditableProposals): CvReviewDecisions {
  return cvReviewDecisionsSchema.parse({
    reviewComplete: false,
    scalars: proposals.scalars.map(({ proposalId }) => ({
      proposalId,
      action: "SKIP",
    })),
    experiences: proposals.experiences.map(({ proposalId }) => ({
      proposalId,
      action: "SKIP",
      targetId: null,
    })),
    education: proposals.education.map(({ proposalId }) => ({
      proposalId,
      action: "SKIP",
      targetId: null,
    })),
    skills: proposals.skills.map(({ proposalId }) => ({
      proposalId,
      action: "SKIP",
    })),
    socialLinks: proposals.socialLinks.map(({ proposalId }) => ({
      proposalId,
      action: "SKIP",
      targetId: null,
    })),
  });
}

export class PrismaCvDraftQueryRepository {
  async getOwnedComparison(
    accountId: string,
    draftId: string,
    now = new Date(),
  ) {
    const draft = await prisma.cvDraft.findFirst({
      where: {
        id: draftId,
        accountId,
        status: "EDITABLE",
        expiresAt: { gt: now },
        contentInaccessibleAt: null,
        account: { state: "ACTIVE", deletedAt: null },
        profile: { candidateUserId: accountId },
        upload: {
          accountId,
          profile: { candidateUserId: accountId },
          status: "REVIEW_READY",
          expiresAt: { gt: now },
          contentInaccessibleAt: null,
          deletedAt: null,
        },
      },
      include: {
        profile: {
          include: {
            experiences: { orderBy: { position: "asc" } },
            education: { orderBy: { position: "asc" } },
            skills: { orderBy: { position: "asc" } },
            socialLinks: { orderBy: { position: "asc" } },
          },
        },
      },
    });
    if (!draft) return null;
    const proposals = hydrateProvenance(
      draft.proposalPayload,
      draft.provenancePayload,
    );
    const decisions = draft.reviewPayload
      ? cvReviewDecisionsSchema.parse(draft.reviewPayload)
      : defaultDecisions(proposals);
    return cvDraftComparisonSchema.parse({
      draftId: draft.id,
      uploadId: draft.uploadId,
      draftRevision: draft.revision,
      sourceProfileRevision: draft.sourceProfileRevision,
      reviewedProfileRevision: draft.reviewedProfileRevision,
      currentProfile: {
        revision: draft.profile.revision,
        headline: draft.profile.headline,
        summary: draft.profile.summary,
        phone: draft.profile.phone,
        location: draft.profile.location,
        experiences: draft.profile.experiences.map((entry) => ({
          id: entry.id,
          title: entry.title,
          company: entry.company,
          description: entry.description,
          startDate: date(entry.startDate),
          endDate: date(entry.endDate),
          isCurrent: entry.isCurrent,
          position: entry.position,
        })),
        education: draft.profile.education.map((entry) => ({
          id: entry.id,
          institution: entry.institution,
          degree: entry.degree,
          field: entry.field,
          startDate: date(entry.startDate),
          endDate: date(entry.endDate),
          isCurrent: entry.isCurrent,
          position: entry.position,
        })),
        skills: draft.profile.skills.map((entry) => ({
          id: entry.skillId,
          displayName: entry.displayName,
          position: entry.position,
        })),
        socialLinks: draft.profile.socialLinks.map((entry) => ({
          id: entry.id,
          url: entry.url,
          position: entry.position,
        })),
      },
      proposals,
      reviewDecisions: decisions,
      expiresAt: draft.expiresAt.toISOString(),
    });
  }
}
