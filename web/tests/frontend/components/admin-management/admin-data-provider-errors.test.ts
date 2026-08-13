import { describe, expect, it } from "vitest";
import { adminApiErrorDetails } from "@/frontend/features/admin/app/data-provider";

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
});
