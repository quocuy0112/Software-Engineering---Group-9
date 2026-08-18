import { describe, expect, it, vi } from "vitest";
import {
  interviewStagePath,
  RecruiterApplicationDecisionService,
} from "@/backend/applications/services/recruiter-application-decision-service";

describe("recruiter interview decision sequencing", () => {
  it("includes Shortlisted between Viewed and Interviewing", () => {
    expect(interviewStagePath("VIEWED")).toEqual([
      "VIEWED",
      "SHORTLISTED",
      "INTERVIEWING",
    ]);
    expect(interviewStagePath("SHORTLISTED")).toEqual([
      "SHORTLISTED",
      "INTERVIEWING",
    ]);
  });

  it("persists both events and both public updates for a Viewed candidate", async () => {
    const requestedAt = new Date("2026-08-18T06:30:00.000Z");
    const stageEventCreate = vi
      .fn()
      .mockResolvedValueOnce({
        id: "stage-event-shortlisted",
        fromStage: "VIEWED",
        toStage: "SHORTLISTED",
        actorUserId: "recruiter-1",
        occurredAt: requestedAt,
        applicationVersion: 3,
        reasonCode: "RECRUITER_AUTO_SHORTLISTED_FOR_INTERVIEW",
        notificationRequired: false,
        notificationStatus: "NOT_REQUIRED",
      })
      .mockResolvedValueOnce({
        id: "stage-event-interview",
        fromStage: "SHORTLISTED",
        toStage: "INTERVIEWING",
        actorUserId: "recruiter-1",
        occurredAt: new Date(requestedAt.getTime() + 1),
        applicationVersion: 4,
        reasonCode: "RECRUITER_CONFIRMED_INTERVIEW",
        notificationRequired: true,
        notificationStatus: "PENDING",
      });
    const publicUpdateCreate = vi.fn();
    const tx = {
      applicationStageEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: stageEventCreate,
      },
      applicationPublicUpdate: { create: publicUpdateCreate },
      jobApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "application-1",
          stage: "VIEWED",
          stageVersion: 2,
          withdrawalOutcome: null,
          candidateUserId: "candidate-1",
          candidate: {
            user: { preferences: { applicationUpdatesEmail: false } },
          },
          notificationPreference: { emailEnabled: false, inAppEnabled: false },
          jobPosting: {
            title: "Flutter Developer",
            company: { displayName: "Apex Trading Co." },
          },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
    const db = {
      jobApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "application-1",
          jobPostingId: "job-1",
        }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new RecruiterApplicationDecisionService(
      db as never,
      {
        authorizeApplication: vi.fn().mockResolvedValue({ authorized: true }),
      } as never,
    );

    await expect(
      service.moveToInterview({
        userId: "recruiter-1",
        sessionId: "session-1",
        applicationId: "application-1",
        idempotencyKey: "decision-1",
        raw: { confirmed: true, expectedStageVersion: 2 },
        now: requestedAt,
      }),
    ).resolves.toMatchObject({
      fromStage: "VIEWED",
      toStage: "INTERVIEWING",
      stageVersion: 4,
      stageEventId: "stage-event-interview",
    });

    expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          stage: "INTERVIEWING",
          stageVersion: { increment: 2 },
          lastStageChangedAt: new Date(requestedAt.getTime() + 1),
        },
      }),
    );
    expect(stageEventCreate).toHaveBeenCalledTimes(2);
    expect(
      stageEventCreate.mock.calls.map(([call]) => call.data.toStage),
    ).toEqual(["SHORTLISTED", "INTERVIEWING"]);
    expect(
      stageEventCreate.mock.calls.map(([call]) => call.data.applicationVersion),
    ).toEqual([3, 4]);
    expect(publicUpdateCreate).toHaveBeenCalledTimes(2);
    expect(
      publicUpdateCreate.mock.calls.map(([call]) => call.data.title),
    ).toEqual(["Application shortlisted", "Interview stage reached"]);
  });
});
