import { afterEach, describe, expect, it, vi } from "vitest";
import { adminApiErrorDetails } from "@/frontend/features/admin/app/data-provider";
import { adminDataProvider } from "@/frontend/features/admin/app/data-provider";

const originalFetch = globalThis.fetch;
const detailCases: Array<
  [string, { account: { id: string } } | { request: { id: string } }, string]
> = [
  ["accounts", { account: { id: "account-1" } }, "account-1"],
  ["verification-requests", { request: { id: "request-1" } }, "request-1"],
];

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("admin data provider errors", () => {
  it("reads ordinary admin error envelopes", () => {
    expect(adminApiErrorDetails({ code: "CASE_UNAVAILABLE" })).toEqual({
      code: "CASE_UNAVAILABLE",
      message: "CASE_UNAVAILABLE",
    });
  });

  it("reads nested professional connection error envelopes", () => {
    expect(
      adminApiErrorDetails({
        error: {
          code: "RESOURCE_UNAVAILABLE",
          message: "This professional connection resource is unavailable.",
        },
      }),
    ).toEqual({
      code: "RESOURCE_UNAVAILABLE",
      message: "This professional connection resource is unavailable.",
    });
  });

  it("falls back safely for malformed responses", () => {
    expect(adminApiErrorDetails(null)).toEqual({
      code: "INTERNAL_FAILURE",
      message: "INTERNAL_FAILURE",
    });
  });

  it.each(detailCases)(
    "adds the nested detail id required by React Admin for %s",
    async (resource, detail, id) => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(detail), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await adminDataProvider.getOne(resource, { id });

      expect(result.data).toMatchObject({ id });
    },
  );
});
