import { describe, expect, it, vi } from "vitest";
import { ShortlistApplicationService } from "@/backend/applications/services/shortlist-application";
import { JobServiceError } from "@/backend/services/jobs/job-types";

const initialTimestamp = new Date("2026-08-18T06:21:00.000Z");

function application(stage: string, stageVersion: number) {
  return {
    id: "application-1",
    jobPostingId: "job-1",
    stage,
    stageVersion,
    lastStageChangedAt: initialTimestamp,
  };
}

function database() {
  return {
    jobApplication: {
      findUnique: vi.fn(),
    },
  };
}

describe("shortlist application", () => {
  it("transitions a Viewed application once", async () => {
    const db = database();
    db.jobApplication.findUnique.mockResolvedValue(application("VIEWED", 2));
    const stageService = {
      transition: vi.fn().mockResolvedValue({
        applicationId: "application-1",
        fromStage: "VIEWED",
        stage: "SHORTLISTED",
        stageVersion: 3,
        lastStageChangedAt: "2026-08-18T06:22:00.000Z",
        eventId: "event-1",
      }),
    };
    const service = new ShortlistApplicationService(
      db as never,
      {
        authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
      } as never,
      stageService as never,
    );

    await expect(
      service.execute({
        userId: "recruiter-1",
        sessionId: "session-1",
        applicationId: "application-1",
      }),
    ).resolves.toMatchObject({
      applicationId: "application-1",
      stage: "SHORTLISTED",
      stageVersion: 3,
      changed: true,
    });
    expect(stageService.transition).toHaveBeenCalledWith(
      { userId: "recruiter-1", sessionId: "session-1" },
      "application-1",
      {
        targetStage: "SHORTLISTED",
        expectedVersion: 2,
        reasonCode: "RECRUITER_SHORTLISTED_CANDIDATE",
        candidateVisibleReason: "Your application has been shortlisted.",
      },
      undefined,
    );
  });

  it.each([
    ["SHORTLISTED", 3],
    ["INTERVIEWING", 4],
  ])(
    "does not regress an application already at %s",
    async (stage, version) => {
      const db = database();
      db.jobApplication.findUnique.mockResolvedValue(
        application(stage, version),
      );
      const stageService = { transition: vi.fn() };
      const service = new ShortlistApplicationService(
        db as never,
        {
          authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
        } as never,
        stageService as never,
      );

      await expect(
        service.execute({
          userId: "recruiter-1",
          sessionId: "session-1",
          applicationId: "application-1",
        }),
      ).resolves.toMatchObject({
        stage,
        stageVersion: version,
        changed: false,
      });
      expect(stageService.transition).not.toHaveBeenCalled();
    },
  );

  it("rejects a shortlist attempt before the candidate has been viewed", async () => {
    const db = database();
    db.jobApplication.findUnique.mockResolvedValue(application("APPLIED", 1));
    const service = new ShortlistApplicationService(
      db as never,
      {
        authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
      } as never,
      { transition: vi.fn() } as never,
    );

    await expect(
      service.execute({
        userId: "recruiter-1",
        sessionId: "session-1",
        applicationId: "application-1",
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: "APPLICATION_STAGE_TRANSITION_INVALID" },
    });
  });

  it("treats a concurrent Viewed -> Shortlisted winner as an idempotent success", async () => {
    const db = database();
    db.jobApplication.findUnique
      .mockResolvedValueOnce(application("VIEWED", 2))
      .mockResolvedValueOnce(application("SHORTLISTED", 3));
    const stageService = {
      transition: vi.fn().mockRejectedValue(
        new JobServiceError(409, {
          code: "APPLICATION_STAGE_CONFLICT",
          message: "This application changed.",
        }),
      ),
    };
    const service = new ShortlistApplicationService(
      db as never,
      {
        authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
      } as never,
      stageService as never,
    );

    await expect(
      service.execute({
        userId: "recruiter-1",
        sessionId: "session-1",
        applicationId: "application-1",
      }),
    ).resolves.toMatchObject({
      stage: "SHORTLISTED",
      stageVersion: 3,
      changed: false,
    });
  });
});
