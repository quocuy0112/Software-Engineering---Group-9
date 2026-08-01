import { afterEach, describe, expect, it, vi } from "vitest";
import { accountErrorResponse } from "@/backend/security/account-request-boundary";

describe("account API error observability", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns and logs a correlation ID without logging the raw error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = accountErrorResponse(
      new Error("password=secret database error with private details"),
    );
    const correlationId = response.headers.get("X-Correlation-ID");

    expect(response.status).toBe(503);
    expect(correlationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(await response.json()).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    });
    expect(log).toHaveBeenCalledWith(
      `[account-api] request failed correlationId=${correlationId} code=INTERNAL_ERROR`,
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private details");
  });
});
