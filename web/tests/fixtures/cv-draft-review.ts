import {
  cvConfirmationReceiptSchema,
  cvDraftComparisonSchema,
} from "@/shared/contracts/cv-import/review";

const unavailableEvidence = {
  confidence: null,
  locations: [],
  contextAvailable: false,
  context: null,
};

export const cvDraftReviewFixture = cvDraftComparisonSchema.parse({
  draftId: "draft_review_fixture_1234",
  uploadId: "upload_review_fixture_1234",
  draftRevision: 0,
  sourceProfileRevision: 2,
  reviewedProfileRevision: 2,
  currentProfile: {
    revision: 2,
    headline: "Current engineer",
    summary: null,
    phone: null,
    location: "Da Nang",
    experiences: [
      {
        id: "experience_current_1234",
        position: 0,
        title: "Developer",
        company: "Current Company",
        description: null,
        startDate: "2022-01-01",
        endDate: null,
        isCurrent: true,
      },
    ],
    education: [],
    skills: [{ id: "skill_current_1234", displayName: "React", position: 0 }],
    socialLinks: [],
  },
  proposals: {
    scalars: [
      {
        proposalId: "proposal_headline_1234",
        field: "headline",
        value: "Platform engineer",
        evidence: {
          confidence: 0.91,
          locations: ["page-1-heading"],
          contextAvailable: false,
          context: null,
        },
      },
    ],
    experiences: [
      {
        proposalId: "proposal_experience_1234",
        value: {
          title: "Senior developer",
          company: "Example Company",
          description: "Built reliable services.",
          startDate: "2024-01-01",
          endDate: null,
          isCurrent: true,
        },
        duplicateTargetIds: [],
        evidence: unavailableEvidence,
      },
    ],
    education: [],
    skills: [
      {
        proposalId: "proposal_skill_1234",
        value: "TypeScript",
        duplicate: false,
        evidence: unavailableEvidence,
      },
    ],
    socialLinks: [],
  },
  reviewDecisions: {
    reviewComplete: true,
    scalars: [{ proposalId: "proposal_headline_1234", action: "SKIP" }],
    experiences: [
      {
        proposalId: "proposal_experience_1234",
        action: "SKIP",
        targetId: null,
      },
    ],
    education: [],
    skills: [{ proposalId: "proposal_skill_1234", action: "SKIP" }],
    socialLinks: [],
  },
  expiresAt: "2026-08-31T08:00:00.000Z",
});

export const cvConfirmationReceiptFixture = cvConfirmationReceiptSchema.parse({
  receiptId: "receipt_review_fixture_1234",
  uploadId: cvDraftReviewFixture.uploadId,
  draftId: cvDraftReviewFixture.draftId,
  confirmedAt: "2026-08-01T08:15:00.000Z",
  draftRevision: 0,
  sourceProfileRevision: 2,
  reviewedProfileRevision: 2,
  profileRevisionBefore: 2,
  profileRevisionAfter: 3,
  appliedCounts: {
    scalars: 0,
    experiences: 0,
    education: 0,
    skills: 0,
    socialLinks: 0,
  },
});
