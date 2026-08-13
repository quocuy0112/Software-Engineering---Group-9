import { describe, expect, it } from "vitest";
import { getHomePageContext, type HomeContextDependencies } from "@/backend/services/home/get-home-page-context";
import { approvedRecruiterStatus, candidateProfile, jobCard } from "../../../helpers/home/home-fixtures";

function deps(session: HomeContextDependencies["session"], recruiter = approvedRecruiterStatus): HomeContextDependencies {
  return {
    requestHeaders: async () => new Headers(), session,
    searchJobs: async () => [jobCard()], listCompanies: async () => [],
    account: async () => ({ name: "Nguyễn An", image: null, language: "VI" }),
    profile: async () => candidateProfile(), recruiterStatus: async () => recruiter,
    proof: () => "proof", now: () => new Date("2026-08-12T00:00:00.000Z"),
  };
}

describe("Home session viewer matrix", () => {
  it("maps an invalid or expired session to Guest", async () => {
    const model = await getHomePageContext(deps(async () => null));
    expect(model.viewer).toEqual({ kind: "guest" });
    expect(JSON.stringify(model)).not.toContain("proof");
  });
  it("uses candidate presentation until recruiter authority is approved", async () => {
    const status = { state: "PENDING_REVIEW", destinationKind: "NONE", href: null, observedAt: "2026-08-12T00:00:00.000Z" } as const;
    const model = await getHomePageContext(deps(async () => ({ userId: "user-1", sessionId: "session-1" }), status));
    expect(model.viewer.kind).toBe("candidate");
  });
  it("uses employer presentation only for approved recruiter authority", async () => {
    const model = await getHomePageContext(deps(async () => ({ userId: "user-1", sessionId: "session-1" })));
    expect(model.viewer.kind).toBe("employer");
    expect(model.smartMatch.kind).toBe("illustrative");
    expect(model.jobs.items.every((job) => job.matchScore === undefined)).toBe(true);
  });
});
