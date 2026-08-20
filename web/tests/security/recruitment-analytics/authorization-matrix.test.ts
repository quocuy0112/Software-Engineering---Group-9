import { describe, expect, it } from "vitest";
import { AnalyticsAuthorization } from "@/backend/analytics/analytics-authorization";

describe("recruitment analytics authorization matrix", () => {
  it("returns only the authorized employer scope", async () => {
    const authorization = new AnalyticsAuthorization({
      authorizeJob: async (userId, jobPostingId) =>
        (userId === "recruiter-a" && jobPostingId === "job-a"
          ? {
              authorized: true,
              requestedJobId: jobPostingId,
              jobPostingId,
              jobId: jobPostingId,
              companyId: "company-a",
              jobTitle: "Engineer",
              jobStatus: "ACTIVE",
              membershipRole: "RECRUITER",
              canView: true,
              canMoveStages: true,
              canReject: true,
              canRecordOfferDeclined: true,
              canConfirmHired: true,
            }
          : {
              authorized: false,
              requestedJobId: jobPostingId,
              jobPostingId: "",
              jobId: jobPostingId,
              companyId: "",
              jobTitle: "",
              jobStatus: null,
              membershipRole: null,
              canView: false,
              canMoveStages: false,
              canReject: false,
              canRecordOfferDeclined: false,
              canConfirmHired: false,
            }),
    });
    await expect(
      authorization.employerJob("recruiter-a", "job-a"),
    ).resolves.toMatchObject({ companyId: "company-a" });
    await expect(
      authorization.employerJob("recruiter-a", "job-b"),
    ).resolves.toBeNull();
  });

  it("keeps admin access behind the admin request boundary", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "src/app/api/admin/analytics/overview/route.ts",
        "utf8",
      ),
    );
    expect(source).toContain("new AdminRequestBoundary().require(request)");
  });
});
