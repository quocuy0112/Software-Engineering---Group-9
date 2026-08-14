import { describe, expect, it } from "vitest";
import { getHomePageContext, type HomeContextDependencies } from "@/backend/services/home/get-home-page-context";
import {
  approvedRecruiterStatus,
  candidateProfile,
  homeCareerPaths,
  jobCard,
} from "../../helpers/home/home-fixtures";

function dependencies(): HomeContextDependencies {
  return {
    requestHeaders: async () => new Headers(),
    session: async () => null,
    searchJobs: async () => [jobCard()],
    careerPaths: async () => homeCareerPaths,
    listCompanies: async () => [],
    account: async () => ({ name: "Private Name", image: null, language: "EN" }),
    profile: async () => candidateProfile(),
    recruiterStatus: async () => approvedRecruiterStatus,
    proof: () => "private-proof",
    now: () => new Date("2026-08-12T00:00:00.000Z"),
  };
}

describe("Home session privacy", () => {
  it("keeps Guest and expired-session output free of private presentation", async () => {
    for (const session of [async () => null, async () => { throw new Error("expired token raw"); }]) {
      const deps = dependencies();
      deps.session = session;
      const output = JSON.stringify(await getHomePageContext(deps));
      expect(output).not.toMatch(/Private Name|private-proof|expired token|email|membership|applications|profileSignals/iu);
      expect(output).not.toContain('"matchScore"');
    }
  });

  it("does not expose candidate recommendation fields to an employer", async () => {
    const deps = dependencies();
    deps.session = async () => ({ userId: "user-1", sessionId: "session-1" });
    const model = await getHomePageContext(deps);
    expect(model.viewer.kind).toBe("employer");
    expect(model.smartMatch.kind).toBe("illustrative");
    expect(JSON.stringify(model.jobs)).not.toContain('"matchScore"');
    expect(JSON.stringify(model)).not.toContain("profileSignals");
  });
});
