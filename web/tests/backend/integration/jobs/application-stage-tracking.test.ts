import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)(
  "canonical application stage tracking",
  () => {
    let fixture: Awaited<
      ReturnType<
        typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
      >
    >;
    let applicationId: string;

    beforeAll(async () => {
      fixture = await (
        await import("../../../helpers/job-board-database-fixture")
      ).createJobBoardDatabaseFixture("stage-tracking");
      const repository = new (
        await import("@/backend/repositories/jobs/prisma-job-application-repository")
      ).PrismaJobApplicationRepository();
      const submitted = await repository.submit({
        candidateUserId: fixture.userIds[0]!,
        sessionId: "candidate-session",
        jobId: fixture.jobs.active.id,
        idempotencyKey: "stage-tracking-key-0001",
        submissionBindingDigest: "c".repeat(64),
        command: {
          cvId: fixture.confirmedCvIds[0]!,
          answers: fixture.jobs.active.questions.map((question) => ({
            questionId: question.id,
            value: question.kind === "BOOLEAN" ? true : "Five years",
          })),
          coverLetter: "A candidate-visible cover letter.",
          consentVersion: "2026-08-01",
          consentAccepted: true as const,
        },
        activeConsentVersion: "2026-08-01",
        occurredAt: fixture.now,
        correlationId: "correlation-stage-tracking",
      });
      applicationId = submitted.application.applicationId;

      const prisma = (await import("@/backend/database/prisma")).prisma;
      await prisma.companyMembership.create({
        data: {
          companyId: fixture.company.id,
          userId: fixture.userIds[1]!,
          role: "RECRUITER",
          priorApprovedRole: "RECRUITER",
        },
      });
    });

    afterAll(async () => {
      if (fixture) {
        await (
          await import("../../../helpers/job-board-database-fixture")
        ).deleteJobBoardDatabaseFixture(fixture);
      }
    });

    it("returns only candidate-owned applications and candidate-visible history", async () => {
      const repository = new (
        await import("@/backend/repositories/jobs/prisma-application-tracking-repository")
      ).PrismaApplicationTrackingRepository();
      const list = await repository.listCandidateApplications({
        candidateUserId: fixture.userIds[0]!,
        limit: 50,
      });
      const otherCandidate = await repository.listCandidateApplications({
        candidateUserId: fixture.userIds[1]!,
        limit: 50,
      });
      const detail = await repository.getCandidateApplication(
        fixture.userIds[0]!,
        applicationId,
      );

      expect(list.applications).toHaveLength(1);
      expect(list.applications[0]).toMatchObject({
        applicationId,
        stage: "APPLIED",
        stageVersion: 1,
      });
      expect(otherCandidate.applications).toEqual([]);
      expect(detail?.history).toHaveLength(1);
      expect(detail).not.toHaveProperty("recruiterNote");
    });

    it("updates stage, history, audit, and notification atomically", async () => {
      const service = new (
        await import("@/backend/services/jobs/application-stage-service")
      ).ApplicationStageService();
      const result = await service.transition(
        {
          userId: fixture.userIds[1]!,
          sessionId: "recruiter-session",
        },
        applicationId,
        {
          targetStage: "SHORTLISTED",
          expectedVersion: 1,
          candidateVisibleReason: "Your application is moving forward.",
        },
        new Date(fixture.now.getTime() + 60_000),
      );

      expect(result).toMatchObject({
        fromStage: "APPLIED",
        stage: "SHORTLISTED",
        stageVersion: 2,
      });
      const prisma = (await import("@/backend/database/prisma")).prisma;
      expect(
        await prisma.applicationStageEvent.count({
          where: { applicationId },
        }),
      ).toBe(2);
      expect(
        await prisma.recruitmentNotificationWork.count({
          where: {
            applicationId,
            kind: "APPLICATION_STAGE_CHANGED",
          },
        }),
      ).toBe(1);
      expect(
        await prisma.emailOutbox.count({
          where: {
            userId: fixture.userIds[0]!,
            kind: "APPLICATION_STAGE_CHANGED",
            templateVersion: "application-stage-changed.v1",
          },
        }),
      ).toBe(1);
      expect(
        await prisma.auditEvent.count({
          where: {
            targetId: applicationId,
            action: "job.application.stage_changed",
          },
        }),
      ).toBe(1);
    });

    it("rejects a stale version without appending another event", async () => {
      const service = new (
        await import("@/backend/services/jobs/application-stage-service")
      ).ApplicationStageService();
      await expect(
        service.transition(
          {
            userId: fixture.userIds[1]!,
            sessionId: "recruiter-session",
          },
          applicationId,
          { targetStage: "INTERVIEWING", expectedVersion: 1 },
        ),
      ).rejects.toMatchObject({ status: 409 });
      const prisma = (await import("@/backend/database/prisma")).prisma;
      expect(
        await prisma.applicationStageEvent.count({ where: { applicationId } }),
      ).toBe(2);
    });
  },
);
