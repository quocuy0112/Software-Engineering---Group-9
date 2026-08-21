import { describe, expect, it, vi } from "vitest";
import { getHomePageContext, type HomeContextDependencies } from "@/backend/services/home/get-home-page-context";
import {
  approvedRecruiterStatus,
  candidateProfile,
  homeCareerPaths,
  jobCard,
} from "../../../helpers/home/home-fixtures";

const dependencies = (): HomeContextDependencies => ({
  requestHeaders: async () => new Headers(),
  session: async () => null,
  searchJobs: async () => [jobCard()],
  careerPaths: async () => homeCareerPaths,
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
    expect(model.companyCount).toBeNull();
    expect(model.smartMatch.kind).toBe("illustrative");
  });
  it("passes active career-path counts through without hardcoding them", async () => {
    const deps = dependencies();
    deps.careerPaths = async () =>
      homeCareerPaths.map((path) => ({
        ...path,
        openJobCount:
          path.slug === "software-engineering" ? 128 : path.openJobCount,
      }));

    const model = await getHomePageContext(deps);
    expect(model.careerPaths).toContainEqual({
      slug: "software-engineering",
      openJobCount: 128,
    });
  });
  it("isolates company failure from jobs and shell data", async () => {
    const deps = dependencies();
    deps.listCompanies = vi.fn().mockRejectedValue(new Error("private provider error"));
    const model = await getHomePageContext(deps);
    expect(model.jobs.status).toBe("ready");
    expect(model.spotlights.status).toBe("error");
    expect(JSON.stringify(model)).not.toContain("private provider error");
  });

  it("identifies an empty recommendation pool without claiming the profile is incomplete", async () => {
    const deps = dependencies();
    deps.session = async () => ({ userId: "candidate-1", sessionId: "session-1" });
    deps.recruiterStatus = async () => ({
      state: "PENDING_REVIEW",
      destinationKind: "NONE",
      href: null,
      observedAt: "2026-08-12T00:00:00.000Z",
    });
    deps.recommendationJobs = async () => [];

    const model = await getHomePageContext(deps);

    expect(model.smartMatch).toMatchObject({
      kind: "illustrative",
      reason: "noOpportunities",
    });
  });
});
