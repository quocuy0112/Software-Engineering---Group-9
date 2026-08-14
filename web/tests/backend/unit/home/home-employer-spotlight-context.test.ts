import { describe, expect, it, vi } from "vitest";
import { getHomePageContext, type HomeContextDependencies } from "@/backend/services/home/get-home-page-context";
import { homeCareerPaths, jobCard } from "../../../helpers/home/home-fixtures";

const base = (): HomeContextDependencies => ({
  requestHeaders: async () => new Headers(), session: async () => null,
  searchJobs: async () => [jobCard()],
  careerPaths: async () => homeCareerPaths,
  listCompanies: async () => [{ slug: "company", displayName: "Company", logoUrl: null, publicDescription: null, publicLocation: null, industry: null, size: null, openPositionCount: 7 }],
  account: async () => null, profile: vi.fn(), recruiterStatus: vi.fn(), proof: () => "", now: () => new Date("2026-08-12T00:00:00.000Z"),
});

describe("Companies hiring composition", () => {
  it("uses only the independent public company projection", async () => {
    const model = await getHomePageContext(base());
    expect(model.spotlights.items[0]).toMatchObject({ name: "Company", openPositionCount: 7, destination: { kind: "displayOnly" } });
    expect(JSON.stringify(model.spotlights)).not.toMatch(/culture|mentoring|internship-friendly/i);
  });
  it("keeps company error local", async () => {
    const input = base(); input.listCompanies = vi.fn().mockRejectedValue(new Error("down"));
    const model = await getHomePageContext(input);
    expect(model.spotlights.status).toBe("error");
    expect(model.jobs.status).toBe("ready");
  });
});
