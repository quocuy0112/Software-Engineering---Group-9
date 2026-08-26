import { describe, expect, it } from "vitest";
import { jobManagementListQuerySchema } from "@/shared/contracts/admin/job-post-management";

describe("managed job list and detail contract", () => {
  it("accepts bounded discovery filters", () => {
    const result = jobManagementListQuerySchema.safeParse({
      page: "2",
      perPage: "50",
      q: "Platform engineer",
      visibility: "PUBLISHED",
      applicationState: "OPEN",
      reportState: "REPORTED",
      minimumReports: "2",
      featured: "true",
      recruiterId: "recruiter-1",
      approverId: "admin-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unbounded page and report filters", () => {
    expect(jobManagementListQuerySchema.safeParse({ page: 0 }).success).toBe(
      false,
    );
    expect(
      jobManagementListQuerySchema.safeParse({ minimumReports: 100_001 })
        .success,
    ).toBe(false);
  });
});
