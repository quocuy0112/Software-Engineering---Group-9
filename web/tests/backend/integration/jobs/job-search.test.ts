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
    fixture = await helpers.createJobBoardDatabaseFixture("search");
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
    expect(result.rows.map((row) => row.id).sort()).toEqual(
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
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe(fixture.jobs.active.id);
    expect(result.rows[0]?.title).toBe("Lập trình viên TypeScript");
  });
});
