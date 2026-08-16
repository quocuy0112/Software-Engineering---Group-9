import { describe, expect, it } from "vitest";
import { jobManagementCommandSchema } from "@/shared/contracts/admin/job-post-management";

describe("featured placement contract", () => {
  it("requires bounded placement and amendment fields", () => {
    const base = {
      confirmation: true,
      placement: "HOME_FEATURED",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-09-02T00:00:00.000Z",
      priority: 10,
      reason: "Documented promotion.",
    };
    expect(
      jobManagementCommandSchema.safeParse({ ...base, command: "FEATURE" })
        .success,
    ).toBe(true);
    expect(
      jobManagementCommandSchema.safeParse({
        ...base,
        command: "AMEND_FEATURE",
        featureId: "feature-1",
      }).success,
    ).toBe(true);
  });
});
