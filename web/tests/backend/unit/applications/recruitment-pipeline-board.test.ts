import { describe, expect, it, vi } from "vitest";
import { RecruitmentPipelineBoardService } from "@/backend/applications/services/recruitment-pipeline-board";

const stages = ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "HIRED", "OFFER_DECLINED", "REJECTED", "WAITLISTED"] as const;

function authorization(role: "OWNER" | "RECRUITER") {
  const mutable = true;
  return { authorized: true, requestedJobId: "catalogue-1", jobPostingId: "job-1", jobId: "job-1", companyId: "company-1", jobTitle: "Engineer", jobStatus: "CLOSED", membershipRole: role, canView: true, canMoveStages: mutable, canReject: mutable, canRecordOfferDeclined: mutable, canConfirmHired: mutable } as const;
}

describe("RecruitmentPipelineBoardService", () => {
  it("returns nine zero-preserving counts and role capabilities", async () => {
    const revisionAt = new Date("2026-01-01T00:01:00Z");
    const repository = {
      countPipelineStages: vi.fn().mockResolvedValue(Object.fromEntries(stages.map((stage) => [stage, stage === "APPLIED" ? 2 : 0]))),
      latestUpdatedAt: vi.fn().mockResolvedValue(revisionAt),
    };
    const service = new RecruitmentPipelineBoardService(repository as never, { authorizeJob: vi.fn().mockResolvedValue(authorization("OWNER")) } as never);
    const result = await service.metadata({ userId: "user-1", jobId: "catalogue-1", now: new Date("2026-01-01T00:00:00Z") });
    expect(result.stages).toHaveLength(9);
    expect(result.permissions).toMatchObject({ role: "OWNER", canMoveStages: true });
    expect(result.revisionAt).toBe(revisionAt.toISOString());
    expect(repository.countPipelineStages).toHaveBeenCalledWith("job-1");
  });

  it("calculates destinations server-side and keeps scoring optional", async () => {
    const repository = { listPipelineStage: vi.fn().mockResolvedValue({ items: [{ applicationId: "app-1", candidate: { displayName: "Ada", avatarUrl: null }, submittedAt: "2026-01-01T00:00:00.000Z", stage: "APPLIED", stageVersion: 1, documents: { cvAvailable: true, coverLetterAvailable: false }, score: null }], nextCursor: null }) };
    const service = new RecruitmentPipelineBoardService(repository as never, { authorizeJob: vi.fn().mockResolvedValue(authorization("RECRUITER")) } as never);
    const result = await service.stagePage({ userId: "user-1", jobId: "catalogue-1", stage: "APPLIED", limit: 25, now: new Date("2026-01-01T00:00:00Z") });
    expect(result.items[0].score).toBeNull();
    expect(result.items[0].allowedDestinations).toContain("VIEWED");
    expect(result.items[0].allowedDestinations).not.toContain("HIRED");
  });

  it("does not expose controls for a hired application even if stale data includes destinations", async () => {
    const repository = { listPipelineStage: vi.fn().mockResolvedValue({ items: [{ applicationId: "app-hired", candidate: { displayName: "Ada", avatarUrl: null }, submittedAt: "2026-01-01T00:00:00.000Z", stage: "HIRED", stageVersion: 2, documents: { cvAvailable: true, coverLetterAvailable: false }, score: null, allowedDestinations: ["REJECTED", "WAITLISTED"], dragDestinations: ["REJECTED", "WAITLISTED"] }], nextCursor: null }) };
    const service = new RecruitmentPipelineBoardService(repository as never, { authorizeJob: vi.fn().mockResolvedValue(authorization("RECRUITER")) } as never);

    const result = await service.stagePage({ userId: "user-1", jobId: "catalogue-1", stage: "HIRED", limit: 25, now: new Date("2026-01-01T00:00:00Z") });

    expect(result.items[0].allowedDestinations).toEqual([]);
    expect(result.items[0].dragDestinations).toEqual([]);
  });
});
