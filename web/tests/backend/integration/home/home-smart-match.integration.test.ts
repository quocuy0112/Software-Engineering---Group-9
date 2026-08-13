import { describe, expect, it, vi } from "vitest";
import { getHomePageContext, type HomeContextDependencies } from "@/backend/services/home/get-home-page-context";
import { candidateProfile, insufficientCandidateProfile, jobCard } from "../../../helpers/home/home-fixtures";

function candidateDeps(): HomeContextDependencies {
  return {
    requestHeaders: async () => new Headers(), session: async () => ({ userId: "candidate-1", sessionId: "session-1" }),
    searchJobs: async () => [jobCard()], listCompanies: async () => [],
    account: async () => ({ name: "An", image: null, language: "EN" }),
    profile: async () => candidateProfile(),
    recruiterStatus: async () => ({ state: "NEVER_APPLIED", destinationKind: "EMPLOYER_VERIFICATION", href: "/dashboard/employer-verification", observedAt: "2026-08-12T00:00:00.000Z" }),
    proof: () => "proof", now: () => new Date("2026-08-12T00:00:00.000Z"),
  };
}

describe("Home Smart Match composition", () => {
  it("projects one genuine candidate job-fit estimate and corresponding card score", async () => {
    const model = await getHomePageContext(candidateDeps());
    expect(model.smartMatch.kind).toBe("personal");
    expect(model.jobs.items.filter((job) => job.matchScore !== undefined)).toHaveLength(1);
  });
  it("falls back to illustration when profile signals or computation are unavailable", async () => {
    const insufficient = candidateDeps(); insufficient.profile = async () => insufficientCandidateProfile();
    expect((await getHomePageContext(insufficient)).smartMatch.kind).toBe("illustrative");
    const unavailable = candidateDeps(); unavailable.profile = vi.fn().mockRejectedValue(new Error("unavailable"));
    const model = await getHomePageContext(unavailable);
    expect(model.smartMatch.kind).toBe("illustrative");
    expect(model.jobs.items.every((job) => job.matchScore === undefined)).toBe(true);
  });
});
