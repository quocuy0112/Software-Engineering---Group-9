import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cvHttpErrorResponse,
  CvImportServiceError,
} from "@/backend/services/cv-import/cv-http-errors";

afterEach(() => vi.restoreAllMocks());

describe("CV HTTP error boundary", () => {
  it("keeps unexpected details server-side while logging a request reference", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = cvHttpErrorResponse(
      new Error("unique database constraint detail"),
      "request-confirm-123",
      { operation: "cv-draft.confirm", draftId: "draft-123" },
    );
    const body = (await response.json()) as {
      error: { message: string; requestId: string };
    };

    expect(response.status).toBe(503);
    expect(body.error.message).toBe(
      "CV processing is temporarily unavailable.",
    );
    expect(body.error.requestId).toBe("request-confirm-123");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("unique database constraint detail"),
    );
    expect(log.mock.calls[0]?.[0]).toContain("request-confirm-123");
  });

  it("does not log expected domain validation failures", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    cvHttpErrorResponse(new CvImportServiceError("VALIDATION_ERROR"));
    expect(log).not.toHaveBeenCalled();
  });
});
