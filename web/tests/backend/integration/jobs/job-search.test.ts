import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)("PostgreSQL public job search", () => {
  let fixture: Awaited<
    ReturnType<
      typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
    >
  >;
  let repository: InstanceType<
    typeof import("@/backend/repositories/jobs/prisma-public-job-repository").PrismaPublicJobRepository
  >;

  beforeAll(async () => {
    const helpers = await import("../../../helpers/job-board-database-fixture");
    const repositoryModule =
      await import("@/backend/repositories/jobs/prisma-public-job-repository");
    // Keep this fixture at the front of NEWEST even when a developer database
    // already contains the large synthetic performance corpus.
    fixture = await helpers.createJobBoardDatabaseFixture(
      "search",
      new Date("2099-08-01T08:00:00.000Z"),
    );
    repository = new repositoryModule.PrismaPublicJobRepository();
  });

  afterAll(async () => {
    const helpers = await import("../../../helpers/job-board-database-fixture");
    if (fixture) await helpers.deleteJobBoardDatabaseFixture(fixture);
  });

  it("returns only active approved in-window postings", async () => {
    const result = await repository.search(
      {
        normalizedQuery: "",
        normalizedLocation: "",
        normalizedSkills: [],
        employmentType: [],
        experienceLevel: [],
        workArrangement: [],
        salaryCurrency: "VND",
        salaryPeriod: "MONTH",
        sort: "NEWEST",
        limit: 20,
      },
      null,
      fixture.now,
    );
    const fixtureRows = result.rows.filter(
      (row) => row.companyId === fixture.company.id,
    );
    expect(fixtureRows.map((row) => row.id).sort()).toEqual(
      [fixture.jobs.active.id, fixture.jobs.activeSecond.id].sort(),
    );
  });

  it("exposes every candidate-visible posting to server-side recommendations", async () => {
    const rows = await repository.findPublicRecommendationCandidates(
      fixture.userIds[0]!,
      fixture.now,
    );
    const fixtureRows = rows.filter(
      (row) => row.companyId === fixture.company.id,
    );

    expect(fixtureRows.map((row) => row.id).sort()).toEqual(
      [fixture.jobs.active.id, fixture.jobs.activeSecond.id].sort(),
    );
  });

  it("matches Vietnamese text without case or diacritics and applies filters", async () => {
    const result = await repository.search(
      {
        normalizedQuery: "lap trinh vien",
        normalizedLocation: "ho chi minh",
        normalizedSkills: ["typescript"],
        employmentType: ["FULL_TIME"],
        experienceLevel: ["MID"],
        workArrangement: ["HYBRID"],
        salaryMin: 30_000_000,
        salaryMax: 50_000_000,
        salaryCurrency: "VND",
        salaryPeriod: "MONTH",
        sort: "RELEVANCE",
        limit: 20,
      },
      fixture.userIds[0]!,
      fixture.now,
    );
    const fixtureRows = result.rows.filter(
      (row) => row.companyId === fixture.company.id,
    );
    expect(fixtureRows).toHaveLength(1);
    expect(fixtureRows[0]?.id).toBe(fixture.jobs.active.id);
    expect(fixtureRows[0]?.title).toBe("Lập trình viên TypeScript");
  });

  it("searches skills and accent-insensitive company names from the free-text field", async () => {
    const skillResult = await repository.search(
      {
        normalizedQuery: "typescript",
        searchBy: "BOTH",
        normalizedLocation: "",
        normalizedSkills: [],
        employmentType: [],
        experienceLevel: [],
        workArrangement: [],
        salaryCurrency: "VND",
        salaryPeriod: "MONTH",
        sort: "NEWEST",
        limit: 20,
      },
      null,
      fixture.now,
    );
    expect(
      skillResult.rows.filter((row) => row.companyId === fixture.company.id),
    ).toHaveLength(2);

    const companyResult = await repository.search(
      {
        normalizedQuery: "cong ty smarthire",
        searchBy: "COMPANY",
        normalizedLocation: "",
        normalizedSkills: [],
        employmentType: [],
        experienceLevel: [],
        workArrangement: [],
        salaryCurrency: "VND",
        salaryPeriod: "MONTH",
        sort: "NEWEST",
        limit: 20,
      },
      null,
      fixture.now,
    );
    expect(
      companyResult.rows.filter((row) => row.companyId === fixture.company.id),
    ).toHaveLength(2);
  });

  it("matches location terms regardless of the order entered by the visitor", async () => {
    const result = await repository.search(
      {
        normalizedQuery: "",
        normalizedLocation: "minh chi ho",
        normalizedSkills: [],
        employmentType: [],
        experienceLevel: [],
        workArrangement: [],
        salaryCurrency: "VND",
        salaryPeriod: "MONTH",
        sort: "NEWEST",
        limit: 20,
      },
      null,
      fixture.now,
    );
    const fixtureRows = result.rows.filter(
      (row) => row.companyId === fixture.company.id,
    );
    expect(fixtureRows.map((row) => row.id)).toEqual([fixture.jobs.active.id]);
  });
});
