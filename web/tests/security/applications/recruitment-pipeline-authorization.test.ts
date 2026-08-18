import { describe, expect, it, vi } from "vitest";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";

vi.mock("@/backend/services/jobs/recruiter-job-posting-data", () => ({
  authorizeLegacyRecruiterJobs: vi.fn(async () => new Map()),
}));

type Role = "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER";

function row(role: Role, overrides: Record<string, unknown> = {}) {
  return {
    id: `job-${role.toLowerCase()}`,
    companyId: `company-${role.toLowerCase()}`,
    title: `${role} job`,
    status: "ACTIVE",
    removedAt: null,
    company: {
      verificationState: "ACTIVE",
      verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      verificationInactiveAt: null,
      memberships: [
        {
          role,
          status: "ACTIVE",
          removedAt: null,
          user: { state: "ACTIVE", deletedAt: null },
        },
      ],
    },
    ...overrides,
  };
}

function authorizationFor(rows: unknown[]) {
  return new RecruiterApplicationAuthorization({
    jobPosting: { findMany: vi.fn().mockResolvedValue(rows) },
    jobPostReviewAggregate: { findMany: vi.fn().mockResolvedValue([]) },
    jobApplication: { findFirst: vi.fn().mockResolvedValue(null) },
  } as never);
}

describe("recruitment pipeline authorization matrix", () => {
  it("allows OWNER and recruiter roles to manage the pipeline", async () => {
    const roles: Role[] = ["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"];
    const results = await authorizationFor(roles.map((role) => row(role))).authorizeJobs(
      "user-1",
      roles.map((role) => `job-${role.toLowerCase()}`),
    );

    expect(results).toHaveLength(4);
    for (const result of results) {
      expect(result).toMatchObject({ authorized: true, canView: true });
      const mutable = true;
      expect(result.canMoveStages).toBe(mutable);
      expect(result.canReject).toBe(mutable);
      expect(result.canRecordOfferDeclined).toBe(mutable);
      expect(result.canConfirmHired).toBe(mutable);
    }
  });

  it.each([
    ["inactive account", { company: { ...row("RECRUITER").company, memberships: [{ role: "RECRUITER", status: "ACTIVE", removedAt: null, user: { state: "SUSPENDED", deletedAt: null } }] } }],
    ["deleted account", { company: { ...row("RECRUITER").company, memberships: [{ role: "RECRUITER", status: "ACTIVE", removedAt: null, user: { state: "ACTIVE", deletedAt: new Date() } }] } }],
    ["suspended membership", { company: { ...row("RECRUITER").company, memberships: [{ role: "RECRUITER", status: "SUSPENDED", removedAt: null, user: { state: "ACTIVE", deletedAt: null } }] } }],
    ["removed membership", { company: { ...row("RECRUITER").company, memberships: [{ role: "RECRUITER", status: "REMOVED", removedAt: new Date(), user: { state: "ACTIVE", deletedAt: null } }] } }],
    ["inactive verification", { company: { ...row("RECRUITER").company, verificationState: "INACTIVE", verificationInactiveAt: new Date() } }],
  ])("denies %s without leaking tenant context", async (_label, overrides) => {
    const result = await authorizationFor([row("RECRUITER", overrides)]).authorizeJob(
      "user-1",
      "job-recruiter",
    );
    expect(result).toMatchObject({
      authorized: false,
      requestedJobId: "job-recruiter",
      companyId: "",
      jobPostingId: "",
    });
  });

  it("keeps each multi-company result bound to the selected job's company", async () => {
    const result = await authorizationFor([row("RECRUITER"), row("HIRING_MANAGER")]).authorizeJobs(
      "user-1",
      ["job-recruiter", "job-hiring_manager"],
    );
    expect(result.map(({ requestedJobId, companyId }) => ({ requestedJobId, companyId }))).toEqual([
      { requestedJobId: "job-recruiter", companyId: "company-recruiter" },
      { requestedJobId: "job-hiring_manager", companyId: "company-hiring_manager" },
    ]);
  });
});
