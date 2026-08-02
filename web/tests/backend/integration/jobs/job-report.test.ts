import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)("private job report persistence", () => {
  let fixture: Awaited<
    ReturnType<
      typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
    >
  >;
  let repository: InstanceType<
    typeof import("@/backend/repositories/jobs/prisma-job-report-repository").PrismaJobReportRepository
  >;

  beforeAll(async () => {
    fixture = await (
      await import("../../../helpers/job-board-database-fixture")
    ).createJobBoardDatabaseFixture("report");
    repository = new (
      await import("@/backend/repositories/jobs/prisma-job-report-repository")
    ).PrismaJobReportRepository();
  });

  afterAll(async () => {
    if (fixture)
      await (
        await import("../../../helpers/job-board-database-fixture")
      ).deleteJobBoardDatabaseFixture(fixture);
  });

  it("converges concurrent duplicates without changing the posting", async () => {
    const input = {
      reporterUserId: fixture.userIds[0]!,
      sessionId: "session-report",
      jobId: fixture.jobs.active.id,
      reason: "FRAUD" as const,
      details: "Suspected fraudulent contact and payment request.",
      unresolvedKey: `unresolved-${fixture.suffix}`,
      occurredAt: fixture.now,
    };
    const [first, second] = await Promise.all([
      repository.submit({
        ...input,
        correlationId: `report-a-${fixture.suffix}`,
      }),
      repository.submit({
        ...input,
        correlationId: `report-b-${fixture.suffix}`,
      }),
    ]);
    expect([first.created, second.created].sort()).toEqual([false, true]);

    const prisma = (await import("@/backend/database/prisma")).prisma;
    expect(
      await prisma.jobReport.count({
        where: { unresolvedKey: input.unresolvedKey, status: "PENDING_REVIEW" },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: {
          action: "job.report.submitted",
          actorUserId: fixture.userIds[0],
        },
      }),
    ).toBe(1);
    expect(
      await prisma.jobPosting.findUnique({
        where: { id: fixture.jobs.active.id },
        select: { status: true },
      }),
    ).toEqual({ status: "ACTIVE" });
  });
});
