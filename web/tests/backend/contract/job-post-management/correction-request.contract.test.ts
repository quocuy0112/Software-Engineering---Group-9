import { describe, expect, it } from "vitest";
import { jobManagementCommandSchema } from "@/shared/contracts/admin/job-post-management";

describe("job correction request contract", () => {
  it("requires a bounded recruiter-visible explanation", () => {
    const valid = {
      command: "REQUEST_CHANGES",
      confirmation: true,
      hideImmediately: false,
      publicExplanation:
        "Please clarify the salary and mandatory work requirements.",
    };
    expect(jobManagementCommandSchema.safeParse(valid).success).toBe(true);
    expect(
      jobManagementCommandSchema.safeParse({
        ...valid,
        publicExplanation: "Too short",
      }).success,
    ).toBe(false);
  });
});
