import { describe, expect, it } from "vitest";
import { recruiterHeaderStatusSchema } from "@/shared/contracts/recruiter-header-status";

describe("recruiter header route contract", () => {
  it("keeps employer href relative and recruiter href absolute", () => {
    expect(
      recruiterHeaderStatusSchema.parse({
        state: "NEVER_APPLIED",
        destinationKind: "EMPLOYER_VERIFICATION",
        href: "/dashboard/employer-verification",
        observedAt: "2026-08-11T00:00:00.000Z",
      }).href,
    ).toBe("/dashboard/employer-verification");
    expect(
      recruiterHeaderStatusSchema.parse({
        state: "CHANGES_REQUESTED",
        destinationKind: "EMPLOYER_VERIFICATION",
        href: "/dashboard/employer-verification",
        observedAt: "2026-08-11T00:00:00.000Z",
      }).href,
    ).toBe("/dashboard/employer-verification");
    expect(
      recruiterHeaderStatusSchema.parse({
        state: "APPROVED",
        destinationKind: "RECRUITER_WORKSPACE",
        href: "https://recruiter.example.test",
        observedAt: "2026-08-11T00:00:00.000Z",
      }).href,
    ).toBe("https://recruiter.example.test");
  });
});
