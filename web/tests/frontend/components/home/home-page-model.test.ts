import { describe, expect, it } from "vitest";
import { validateHomePageModel } from "@/frontend/features/home/home-page-model";
import {
  candidateViewer,
  companySpotlight,
  employerViewer,
  homeJob,
  homeModel,
  personalMatch,
} from "../../../helpers/home/home-fixtures";

describe("Home page model invariants", () => {
  it("allows a bounded candidate personal recommendation", () => {
    const match = personalMatch();
    expect(
      validateHomePageModel(
        homeModel({
          viewer: candidateViewer,
          match,
          jobs: [
            homeJob({
              matchScore: match.score,
              matchSource: match.scoreSource,
              matchBreakdown: match.matchBreakdown,
            }),
          ],
        }),
      ),
    ).toBeTruthy();
  });
  it("rejects personal output for a guest or employer", () => {
    expect(() =>
      validateHomePageModel(homeModel({ match: personalMatch() })),
    ).toThrow("HOME_PERSONAL_MATCH_AUTHORITY");
    expect(() =>
      validateHomePageModel(
        homeModel({
          viewer: employerViewer,
          jobs: [homeJob({ matchScore: 50 })],
        }),
      ),
    ).toThrow("HOME_JOB_SCORE_AUTHORITY");
  });
  it("rejects more than six jobs", () => {
    expect(() =>
      validateHomePageModel(
        homeModel({
          jobs: Array.from({ length: 7 }, (_, index) =>
            homeJob({ id: `job-${index}` }),
          ),
        }),
      ),
    ).toThrow("HOME_SECTION_LIMIT");
  });
  it("rejects private Guest fields and illustrative card scores", () => {
    expect(() =>
      validateHomePageModel({
        ...homeModel(),
        viewer: { kind: "guest", email: "private@example.test" } as never,
      }),
    ).toThrow("HOME_VIEWER_PRIVATE_FIELD");
    expect(() =>
      validateHomePageModel(homeModel({ jobs: [homeJob({ matchScore: 82 })] })),
    ).toThrow("HOME_JOB_SCORE_AUTHORITY");
  });
  it("rejects unsupported company claims and interactive destinations", () => {
    expect(() =>
      validateHomePageModel(
        homeModel({
          companies: [companySpotlight({ culture: "Amazing" } as never)],
        }),
      ),
    ).toThrow("HOME_COMPANY_DESTINATION");
    expect(() =>
      validateHomePageModel(
        homeModel({
          companies: [
            companySpotlight({
              destination: { kind: "link", href: "/companies/x" },
            } as never),
          ],
        }),
      ),
    ).toThrow("HOME_COMPANY_DESTINATION");
  });
  it("rejects dishonest section recovery metadata", () => {
    expect(() =>
      validateHomePageModel({
        ...homeModel(),
        jobs: {
          status: "error",
          items: [],
          recovery: { kind: "scoped", source: "companies" },
        },
      }),
    ).toThrow("HOME_RECOVERY_SCOPE");
  });
});
