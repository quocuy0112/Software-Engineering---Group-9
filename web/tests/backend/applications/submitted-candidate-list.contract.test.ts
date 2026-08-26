import { describe, expect, it, vi } from "vitest";
vi.mock("@/backend/database/prisma", () => ({ prisma: {} }));
import { ListSubmittedCandidatesService } from "@/backend/applications/services/list-submitted-candidates";
import type { ApplicationRepositoryPort } from "@/backend/repositories/applications/application-repository";
import { applicationPageFixture } from "../../helpers/application-fixture";

function repository(page = applicationPageFixture()): ApplicationRepositoryPort {
  return {
    listSubmittedCandidates: vi.fn().mockResolvedValue(page),
    findDocument: vi.fn(),
  };
}

describe("submitted candidate list orchestration", () => {
  it("authorizes before reading and caps the repository page at 100", async () => {
    const repo = repository();
    const authorization = { authorizeJob: vi.fn().mockResolvedValue({ authorized: true }) };
    const service = new ListSubmittedCandidatesService(repo, authorization as never);

    await service.execute({ userId: "recruiter-1", jobId: "job-1", limit: 500 });

    expect(authorization.authorizeJob).toHaveBeenCalledWith("recruiter-1", "job-1");
    expect(repo.listSubmittedCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", limit: 100 }),
    );
  });

  it("returns a neutral failure for an unauthorized job", async () => {
    const repo = repository();
    const authorization = { authorizeJob: vi.fn().mockResolvedValue({ authorized: false }) };
    const service = new ListSubmittedCandidatesService(repo, authorization as never);

    await expect(service.execute({ userId: "other", jobId: "foreign" })).rejects.toThrow(
      "APPLICATION_UNAVAILABLE",
    );
    expect(repo.listSubmittedCandidates).not.toHaveBeenCalled();
  });
});
