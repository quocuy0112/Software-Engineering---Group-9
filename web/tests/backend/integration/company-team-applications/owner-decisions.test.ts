import { describe, expect, it } from "vitest";
import { ownerProjection } from "@/backend/services/company-members/team-application-owner-service";

describe("Owner Team Application decisions", () => {
  it("keeps applicant CV metadata and private decision reason in the Owner projection", () => {
    const result = ownerProjection({
      id: "application-1",
      companyId: "company-1",
      appliedRole: "RECRUITER",
      status: "REJECTED",
      applicationEmail: "candidate@example.com",
      submittedAt: new Date("2026-08-27T00:00:00.000Z"),
      ownerFirstViewedAt: new Date("2026-08-27T01:00:00.000Z"),
      decidedAt: new Date("2026-08-27T02:00:00.000Z"),
      joinedAt: null,
      company: { displayName: "Northstar Labs", slug: "northstar-labs" },
      invitation: null,
      candidate: { user: { name: "Candidate Nguyen" } },
      cvFileName: "resume.pdf",
      cvMimeType: "application/pdf",
      cvByteSize: 64,
      rejectionReason: "Optional owner feedback",
    });

    expect(result.candidateName).toBe("Candidate Nguyen");
    expect(result.rejectionReason).toBe("Optional owner feedback");
    expect(result.invitationStatus).toBeNull();
  });
});
