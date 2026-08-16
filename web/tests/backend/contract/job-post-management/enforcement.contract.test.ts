import { describe, expect, it } from "vitest";
import { jobManagementCommandSchema } from "@/shared/contracts/admin/job-post-management";

describe("job enforcement contract", () => {
  it("accepts bounded report links and validates change explanations", () => {
    const base = {
      command: "ENFORCE",
      confirmation: true,
      reportIds: ["report-1"],
      reason: "Evidence supports this enforcement.",
    };
    expect(
      jobManagementCommandSchema.safeParse({ ...base, type: "HIDE_JOB" })
        .success,
    ).toBe(true);
    expect(
      jobManagementCommandSchema.safeParse({ ...base, type: "REQUEST_CHANGES" })
        .success,
    ).toBe(false);
  });
});
