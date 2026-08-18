import { describe, expect, it, vi } from "vitest";
import { MarkApplicationViewedService } from "@/backend/applications/services/mark-application-viewed";
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

describe("mark application viewed", () => {
  it("transitions an Applied application once when the detail panel opens", async () => {
    const db = database();
    db.jobApplication.findUnique.mockResolvedValue(application("APPLIED", 1));
    const authorization = {
      authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
    };
    const stageService = {
      transition: vi.fn().mockResolvedValue({
        applicationId: "application-1",
        fromStage: "APPLIED",
        stage: "VIEWED",
        stageVersion: 2,
        lastStageChangedAt: "2026-08-18T06:22:00.000Z",
        eventId: "event-1",
      }),
    };
    const service = new MarkApplicationViewedService(
      db as never,
      authorization as never,
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
      stage: "VIEWED",
      stageVersion: 2,
      changed: true,
    });
    expect(stageService.transition).toHaveBeenCalledWith(
      { userId: "recruiter-1", sessionId: "session-1" },
      "application-1",
      { targetStage: "VIEWED", expectedVersion: 1 },
      undefined,
    );
  });

  it.each([
    ["VIEWED", 2],
    ["SHORTLISTED", 3],
    ["INTERVIEWING", 4],
  ])("does not regress an application already at %s", async (stage, version) => {
    const db = database();
    db.jobApplication.findUnique.mockResolvedValue(application(stage, version));
    const stageService = { transition: vi.fn() };
    const service = new MarkApplicationViewedService(
      db as never,
      { authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }) } as never,
      stageService as never,
    );

    await expect(
      service.execute({
        userId: "recruiter-1",
        sessionId: "session-1",
        applicationId: "application-1",
      }),
    ).resolves.toMatchObject({ stage, stageVersion: version, changed: false });
    expect(stageService.transition).not.toHaveBeenCalled();
  });

  it("treats a concurrent Applied -> Viewed winner as an idempotent success", async () => {
    const db = database();
    db.jobApplication.findUnique
      .mockResolvedValueOnce(application("APPLIED", 1))
      .mockResolvedValueOnce(application("VIEWED", 2));
    const stageService = {
      transition: vi
        .fn()
        .mockRejectedValue(
          new JobServiceError(409, {
            code: "APPLICATION_STAGE_CONFLICT",
            message: "This application changed.",
          }),
        ),
    };
    const service = new MarkApplicationViewedService(
      db as never,
      { authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }) } as never,
      stageService as never,
    );

    await expect(
      service.execute({
        userId: "recruiter-1",
        sessionId: "session-1",
        applicationId: "application-1",
      }),
    ).resolves.toMatchObject({ stage: "VIEWED", stageVersion: 2, changed: false });
  });
});
