import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TeamApplicationAuthorizationError,
  requireTeamApplicationOwner,
} from "@/backend/services/company-members/team-application-authorization";

const { applicationFindUnique, requireOwner } = vi.hoisted(() => ({
  applicationFindUnique: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock("@/backend/database/prisma", () => ({
  prisma: {
    teamApplication: { findUnique: applicationFindUnique },
  },
}));
vi.mock("@/backend/company-members/company-team-authorization", () => ({
  requireActiveCompanyOwner: requireOwner,
}));

describe("Team Application Owner authorization", () => {
  beforeEach(() => {
    applicationFindUnique.mockReset();
    requireOwner.mockReset();
  });

  it("resolves the company from the application before checking Owner membership", async () => {
    applicationFindUnique.mockResolvedValue({
      id: "application-1",
      companyId: "company-a",
    });
    requireOwner.mockResolvedValue({ companyId: "company-a" });

    await requireTeamApplicationOwner("owner-a", "application-1");

    expect(requireOwner).toHaveBeenCalledWith("owner-a", "company-a");
  });

  it("does not disclose an application to a different company's Owner", async () => {
    applicationFindUnique.mockResolvedValue({
      id: "application-1",
      companyId: "company-a",
    });
    requireOwner.mockRejectedValue(new Error("forbidden"));

    await expect(
      requireTeamApplicationOwner("owner-b", "application-1"),
    ).rejects.toMatchObject({
      code: "TEAM_APPLICATION_FORBIDDEN",
    });
  });

  it("uses the unavailable result for unknown application identifiers", async () => {
    applicationFindUnique.mockResolvedValue(null);

    await expect(
      requireTeamApplicationOwner("owner-a", "missing"),
    ).rejects.toEqual(
      new TeamApplicationAuthorizationError("TEAM_APPLICATION_UNAVAILABLE"),
    );
    expect(requireOwner).not.toHaveBeenCalled();
  });
});
