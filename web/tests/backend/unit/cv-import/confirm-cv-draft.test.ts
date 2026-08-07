import { afterEach, describe, expect, it, vi } from "vitest";

const projection = vi.hoisted(() => ({
  ensureCandidateCvLibrary: vi.fn(),
}));

vi.mock("@/backend/services/profile/candidate-cv-library", () => projection);

import { ConfirmCvDraftService } from "@/backend/services/cv-import/confirm-cv-draft";

afterEach(() => {
  vi.restoreAllMocks();
  projection.ensureCandidateCvLibrary.mockReset();
});

describe("ConfirmCvDraftService", () => {
  it("does not turn a Saved CV projection failure into a failed confirmation", async () => {
    const receipt = {
      receiptId: "receipt-1",
      uploadId: "upload-1",
      draftId: "draft-1",
    };
    const repository = {
      confirm: vi.fn().mockResolvedValue({ receipt, replayed: false }),
    };
    projection.ensureCandidateCvLibrary.mockRejectedValue(
      new Error("candidate identity is temporarily unavailable"),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new ConfirmCvDraftService(
      repository as never,
      "fixture-confirm-secret",
    );

    const result = await service.execute({
      accountId: "account-1",
      draftId: "draft-1",
      idempotencyKey: "confirm-1",
      request: {
        draftRevision: 0,
        sourceProfileRevision: 0,
        reviewedProfileRevision: 0,
      },
    });

    expect(result).toEqual({ receipt, replayed: false });
    expect(repository.confirm).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("cv_candidate_cv_projection_failed"),
    );
  });
});
