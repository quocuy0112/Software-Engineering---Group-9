import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)("transactional job application", () => {
  let fixture: Awaited<
    ReturnType<
      typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
    >
  >;
  let repository: InstanceType<
    typeof import("@/backend/repositories/jobs/prisma-job-application-repository").PrismaJobApplicationRepository
  >;

  beforeAll(async () => {
    fixture = await (
      await import("../../../helpers/job-board-database-fixture")
    ).createJobBoardDatabaseFixture("application");
    repository = new (
      await import("@/backend/repositories/jobs/prisma-job-application-repository")
    ).PrismaJobApplicationRepository();
  });
  afterAll(async () => {
    if (fixture)
      await (
        await import("../../../helpers/job-board-database-fixture")
      ).deleteJobBoardDatabaseFixture(fixture);
  });

  it("commits one Applied application, initial history, audit, and notification work", async () => {
    const input = {
      candidateUserId: fixture.userIds[0]!,
      sessionId: "session-1",
      jobId: fixture.jobs.active.id,
      idempotencyKey: "application-key-00000001",
      submissionBindingDigest: "b".repeat(64),
      command: {
        cvId: fixture.confirmedCvIds[0]!,
        answers: fixture.jobs.active.questions.map((question) => ({
          questionId: question.id,
          value: question.kind === "BOOLEAN" ? true : "Five years",
        })),
        coverLetter: null,
        consentVersion: "2026-08-01",
        consentAccepted: true as const,
      },
      activeConsentVersion: "2026-08-01",
      occurredAt: fixture.now,
      correlationId: "correlation-application-1",
    };
    const first = await repository.submit(input);
    const second = await repository.submit(input);
    expect(first.created).toBe(true);
    expect(second).toMatchObject({
      created: false,
      application: { applicationId: first.application.applicationId },
    });
    const prisma = (await import("@/backend/database/prisma")).prisma;
    expect(
      await prisma.jobApplication.count({
        where: {
          candidateUserId: fixture.userIds[0],
          jobPostingId: fixture.jobs.active.id,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.recruitmentNotificationWork.count({
        where: { applicationId: first.application.applicationId },
      }),
    ).toBe(2);
    expect(
      await prisma.applicationStageEvent.findMany({
        where: { applicationId: first.application.applicationId },
        select: {
          fromStage: true,
          toStage: true,
          actorType: true,
          applicationVersion: true,
        },
      }),
    ).toEqual([
      {
        fromStage: null,
        toStage: "APPLIED",
        actorType: "CANDIDATE",
        applicationVersion: 1,
      },
    ]);
    expect(
      await prisma.auditEvent.count({
        where: {
          action: "job.application.submitted",
          targetId: first.application.applicationId,
        },
      }),
    ).toBe(1);
  });
});
