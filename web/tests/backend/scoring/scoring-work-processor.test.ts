import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findApplication: vi.fn(),
  findOperation: vi.fn(),
}));

vi.mock("@/backend/database/prisma", () => ({
  prisma: {
    jobApplication: { findUnique: mocks.findApplication },
    scoringOperation: { findUnique: mocks.findOperation },
  },
}));

describe("scoring work processor", () => {
  it("loads a campaign operation by work-item operation id", async () => {
    mocks.findApplication.mockResolvedValue({
      candidateUserId: "candidate-1",
      cvSnapshot: {},
      jobSnapshot: {},
      coverLetter: null,
      applicationDocuments: [],
      jobPosting: { skills: [] },
    });
    mocks.findOperation.mockResolvedValue({
      kind: "JOB_RESCORE",
      targetJobDescriptionVersionId: "JD-v3",
      targetScoringConfigVersionId: "HS-40/60-v1",
    });

    const { createScoringWorkProcessor } = await import(
      "@/backend/scoring/workers/scoring-work-processor"
    );
    const processor = createScoringWorkProcessor();

    await expect(
      processor({
        workItemId: "work-1",
        operationId: "campaign-operation-1",
        applicationId: "application-1",
        expectedGeneration: 1,
        attemptNumber: 1,
      }),
    ).rejects.toThrow("SCORING_CV_TEXT_UNAVAILABLE");

    expect(mocks.findOperation).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "campaign-operation-1" } }),
    );
  });
});
