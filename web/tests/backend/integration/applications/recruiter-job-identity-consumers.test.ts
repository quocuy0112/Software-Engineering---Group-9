import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ListSubmittedCandidatesService } from "@/backend/applications/services/list-submitted-candidates";
import { OpenApplicationDocumentService } from "@/backend/applications/services/open-application-document";

const context = {
  authorized: true as const,
  requestedJobId: "catalogue-job-1",
  jobPostingId: "persisted-job-1",
  companyId: "company-1",
  jobTitle: "Backend Engineer",
  jobStatus: "ACTIVE" as const,
  membershipRole: "RECRUITER" as const,
  canView: true as const,
  canMoveStages: true,
  canReject: true,
  canRecordOfferDeclined: true,
  canConfirmHired: true,
};

describe("canonical job identity consumers", () => {
  it("passes the canonical job to submitted-candidate retrieval", async () => {
    const repository = {
      listSubmittedCandidates: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      findDocument: vi.fn(),
    };
    const authorization = { authorizeJob: vi.fn().mockResolvedValue(context) };
    await new ListSubmittedCandidatesService(repository, authorization as never).execute({
      userId: "user-1",
      jobId: "catalogue-job-1",
    });
    expect(repository.listSubmittedCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "persisted-job-1" }),
    );
  });

  it("passes the canonical job/application pair to document retrieval", async () => {
    const repository = {
      listSubmittedCandidates: vi.fn(),
      findDocument: vi.fn().mockResolvedValue({
        applicationId: "application-1",
        jobId: "persisted-job-1",
        kind: "cover-letter",
        fileName: null,
        mediaType: null,
        byteLength: 0,
        storageKey: null,
        text: "Cover letter",
        previewSupported: true,
      }),
    };
    const authorization = { authorizeApplication: vi.fn().mockResolvedValue(context) };
    await new OpenApplicationDocumentService(repository, authorization as never).execute({
      userId: "user-1",
      jobId: "catalogue-job-1",
      applicationId: "application-1",
      kind: "cover-letter",
      preview: true,
    });
    expect(repository.findDocument).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "persisted-job-1", applicationId: "application-1" }),
    );
  });

  it("does not retain unresolved jobPostingId queries in ranked, scoring-summary, or rescore services", () => {
    const ranked = readFileSync("src/backend/applications/services/ranked-candidate-list.ts", "utf8");
    const stats = readFileSync("src/backend/applications/services/campaign-scoring-stats.ts", "utf8");
    const rescore = readFileSync("src/backend/scoring/services/job-rescore-service.ts", "utf8");

    expect(ranked).not.toContain("jobPostingId: input.jobId");
    expect(ranked).toContain("authorized.jobPostingId");
    expect(stats).toContain("result.requestedJobId");
    expect(stats).toContain("result.jobPostingId");
    expect(rescore).not.toContain("jobPostingId: input.jobId");
    expect(rescore).toContain("authorized.jobPostingId");
  });
});
