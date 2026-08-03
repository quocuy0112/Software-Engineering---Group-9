import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("saved job service policy", () => {
  it("rejects a job that is not part of the approved public board", async () => {
    const { SavedJobService } =
      await import("@/backend/services/jobs/saved-job-service");
    const writes: string[] = [];
    const savedRepository = {
      save: async () => {
        writes.push("save");
        return true;
      },
      remove: async () => {
        writes.push("remove");
        return false;
      },
    };
    const publicJobs = { findPublicActionTarget: async () => null };
    await expect(
      new SavedJobService(savedRepository, publicJobs).save(
        { userId: "user-1", sessionId: "session-1" },
        "hidden-job",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(writes).toEqual([]);
  });
});

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)("saved job persistence", () => {
  let fixture: Awaited<
    ReturnType<
      typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
    >
  >;
  let repository: InstanceType<
    typeof import("@/backend/repositories/jobs/prisma-saved-job-repository").PrismaSavedJobRepository
  >;

  beforeAll(async () => {
    fixture = await (
      await import("../../../helpers/job-board-database-fixture")
    ).createJobBoardDatabaseFixture("saved-job");
    repository = new (
      await import("@/backend/repositories/jobs/prisma-saved-job-repository")
    ).PrismaSavedJobRepository();
  });

  afterAll(async () => {
    if (fixture)
      await (
        await import("../../../helpers/job-board-database-fixture")
      ).deleteJobBoardDatabaseFixture(fixture);
  });

  it("is idempotent and keeps each user's saved state isolated", async () => {
    const [first, repeated, otherUser] = await Promise.all([
      repository.save(fixture.userIds[0]!, fixture.jobs.active.id),
      repository.save(fixture.userIds[0]!, fixture.jobs.active.id),
      repository.save(fixture.userIds[1]!, fixture.jobs.active.id),
    ]);
    expect([first, repeated, otherUser]).toEqual([true, true, true]);

    const prisma = (await import("@/backend/database/prisma")).prisma;
    expect(
      await prisma.savedJob.count({
        where: { jobPostingId: fixture.jobs.active.id },
      }),
    ).toBe(2);
    expect(
      await repository.remove(fixture.userIds[0]!, fixture.jobs.active.id),
    ).toBe(false);
    expect(
      await repository.remove(fixture.userIds[0]!, fixture.jobs.active.id),
    ).toBe(false);
    expect(
      await prisma.savedJob.count({
        where: {
          userId: fixture.userIds[1],
          jobPostingId: fixture.jobs.active.id,
        },
      }),
    ).toBe(1);
  });
});
