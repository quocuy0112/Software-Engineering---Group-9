import { describe, expect, it } from "vitest";
import {
  recruiterHeaderErrorSchema,
  recruiterHeaderStatusSchema,
} from "@/shared/contracts/recruiter-header-status";

const observedAt = "2026-08-11T00:00:00.000Z";

describe("recruiter header status contract", () => {
  it.each([
    [
      "NEVER_APPLIED",
      "EMPLOYER_VERIFICATION",
      "/dashboard/employer-verification",
    ],
    ["PENDING_REVIEW", "NONE", null],
    ["REJECTED", "EMPLOYER_VERIFICATION", "/dashboard/employer-verification"],
    ["APPROVED", "RECRUITER_WORKSPACE", "https://recruiter.example.test"],
  ])("accepts %s projection", (state, destinationKind, href) => {
    expect(
      recruiterHeaderStatusSchema.parse({
        state,
        destinationKind,
        href,
        observedAt,
      }),
    ).toMatchObject({ state, destinationKind, href });
  });

  it("rejects state and destination mismatches and unknown fields", () => {
    expect(() =>
      recruiterHeaderStatusSchema.parse({
        state: "PENDING_REVIEW",
        destinationKind: "EMPLOYER_VERIFICATION",
        href: "/dashboard/employer-verification",
        observedAt,
      }),
    ).toThrow();
    expect(() =>
      recruiterHeaderStatusSchema.parse({
        state: "REJECTED",
        destinationKind: "EMPLOYER_VERIFICATION",
        href: "/dashboard/employer-verification",
        observedAt,
        accountId: "forbidden",
      }),
    ).toThrow();
  });

  it("accepts only safe error codes", () => {
    expect(recruiterHeaderErrorSchema.parse({ code: "UNAUTHORIZED" })).toEqual({
      code: "UNAUTHORIZED",
    });
    expect(() =>
      recruiterHeaderErrorSchema.parse({
        code: "UNAVAILABLE",
        detail: "secret",
      }),
    ).toThrow();
  });
});
