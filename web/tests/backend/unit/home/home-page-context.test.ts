import { describe, expect, it, vi } from "vitest";
import { getHomePageContext, type HomeContextDependencies } from "@/backend/services/home/get-home-page-context";
import { approvedRecruiterStatus, candidateProfile, jobCard } from "../../../helpers/home/home-fixtures";

const dependencies = (): HomeContextDependencies => ({
  requestHeaders: async () => new Headers(),
  session: async () => null,
  searchJobs: async () => [jobCard()],
  listCompanies: async () => [{ slug: "verified-company", displayName: "Verified Company", logoUrl: null, publicDescription: null, publicLocation: "Hà Nội", industry: "Technology", size: "51-200", openPositionCount: 2 }],
  account: async () => ({ name: "An", image: null, language: "EN" }),
  profile: async () => candidateProfile(),
  recruiterStatus: async () => approvedRecruiterStatus,
  proof: () => "proof",
  now: () => new Date("2026-08-12T00:00:00.000Z"),
});

describe("Home context composition", () => {
  it("keeps public sections available for guests", async () => {
    const model = await getHomePageContext(dependencies());
    expect(model.viewer.kind).toBe("guest");
    expect(model.jobs.status).toBe("ready");
    expect(model.spotlights.status).toBe("ready");
    expect(model.smartMatch.kind).toBe("illustrative");
  });
  it("isolates company failure from jobs and shell data", async () => {
    const deps = dependencies();
    deps.listCompanies = vi.fn().mockRejectedValue(new Error("private provider error"));
    const model = await getHomePageContext(deps);
    expect(model.jobs.status).toBe("ready");
    expect(model.spotlights.status).toBe("error");
    expect(JSON.stringify(model)).not.toContain("private provider error");
  });
});
