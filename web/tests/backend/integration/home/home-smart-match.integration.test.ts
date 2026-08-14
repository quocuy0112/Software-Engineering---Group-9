import { describe, expect, it, vi } from "vitest";
import { getHomePageContext, type HomeContextDependencies } from "@/backend/services/home/get-home-page-context";
import {
  candidateProfile,
  homeCareerPaths,
  insufficientCandidateProfile,
  jobCard,
} from "../../../helpers/home/home-fixtures";

function candidateDeps(): HomeContextDependencies {
  return {
    requestHeaders: async () => new Headers(), session: async () => ({ userId: "candidate-1", sessionId: "session-1" }),
    searchJobs: async () => [jobCard()], careerPaths: async () => homeCareerPaths, listCompanies: async () => [],
    account: async () => ({ name: "An", image: null, language: "EN" }),
    profile: async () => candidateProfile(),
    recruiterStatus: async () => ({ state: "NEVER_APPLIED", destinationKind: "EMPLOYER_VERIFICATION", href: "/dashboard/employer-verification", observedAt: "2026-08-12T00:00:00.000Z" }),
    proof: () => "proof", now: () => new Date("2026-08-12T00:00:00.000Z"),
  };
}

describe("Home Smart Match composition", () => {
  it("ranks every available job using genuine candidate fit data", async () => {
    const deps = candidateDeps();
    deps.searchJobs = async () => [
      jobCard(),
      jobCard({
        id: "job-2",
        slug: "rust-role",
        title: "Rust Developer",
        location: "Da Nang",
        skills: ["Rust"],
      }),
    ];
    const model = await getHomePageContext(deps);
    expect(model.smartMatch.kind).toBe("personal");
    expect(model.jobs.items).toHaveLength(2);
    expect(model.jobs.items.every((job) => job.matchScore !== undefined)).toBe(true);
    expect(model.jobs.items[0]?.matchScore).toBeGreaterThanOrEqual(
      model.jobs.items[1]?.matchScore ?? 0,
    );
    expect(model.smartMatch).toMatchObject({
      jobSlug: model.jobs.items[0]?.slug,
      score: model.jobs.items[0]?.matchScore,
    });
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
