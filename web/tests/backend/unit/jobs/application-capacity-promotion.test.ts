import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInAppNotification: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("@/backend/notifications/notification-service", () => ({
  createInAppNotification: mocks.createInAppNotification,
}));

vi.mock("@/backend/repositories/audit/prisma-audit-repository", () => ({
  PrismaAuditRepository: class {
    append(...args: unknown[]) {
      return mocks.appendAudit(...args);
    }
  },
}));

import { promoteWaitlistedApplicationsInTransaction } from "@/backend/services/jobs/application-stage-service";
import {
  canCapacityPromoteApplicationStage,
  ordinaryApplicationTransitions,
} from "@/backend/services/jobs/application-stage-policy";

function application(
  id: string,
  finalScore: number | null,
  submittedAt: string,
) {
  return {
    id,
    candidateUserId: "candidate-" + id,
    stageVersion: 4,
    submittedAt: new Date(submittedAt),
    currentScoringResult:
      finalScore === null ? null : { state: "SCORED", finalScore },
    notificationPreference: { inAppEnabled: true },
  };
}

function database(input: {
  hiredCount: number;
  waitlisted: ReturnType<typeof application>[];
}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    jobPosting: {
      findUnique: vi.fn().mockResolvedValue({
        title: "Senior TypeScript Engineer",
        companyId: "company-1",
        company: { displayName: "SmartHire" },
      }),
    },
    jobApplication: {
      count: vi.fn().mockResolvedValue(input.hiredCount),
      findMany: vi.fn().mockResolvedValue(input.waitlisted),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    applicationStageEvent: {
      create: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: { applicationId: string } }) => ({
            id: "event-" + data.applicationId,
          }),
        ),
    },
    applicationPublicUpdate: { create: vi.fn().mockResolvedValue({}) },
    recruitmentNotificationWork: { create: vi.fn().mockResolvedValue({}) },
    emailOutbox: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe("waitlisted capacity promotion", () => {
  beforeEach(() => {
    mocks.createInAppNotification.mockReset();
    mocks.createInAppNotification.mockResolvedValue({});
    mocks.appendAudit.mockReset();
    mocks.appendAudit.mockResolvedValue("audit-id");
  });

  it("promotes the highest final scores only until the new capacity is full", async () => {
    const db = database({
      hiredCount: 1,
      waitlisted: [
        application("low", 61, "2026-08-01T00:00:00.000Z"),
        application("high", 96, "2026-08-03T00:00:00.000Z"),
        application("middle", 82, "2026-08-02T00:00:00.000Z"),
      ],
    });

    const promoted = await promoteWaitlistedApplicationsInTransaction({
      db: db as never,
      jobPostingId: "job-1",
      previousCapacity: 1,
      newCapacity: 3,
      correlationId: "capacity-change-2026-08-19",
      now: new Date("2026-08-19T00:00:00.000Z"),
    });

    expect(promoted.map((item) => item.applicationId)).toEqual([
      "high",
      "middle",
    ]);
    expect(db.jobApplication.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: "high" }),
        data: expect.objectContaining({ stage: "HIRED" }),
      }),
    );
    expect(db.jobApplication.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: "middle" }),
        data: expect.objectContaining({ stage: "HIRED" }),
      }),
    );
    expect(db.applicationStageEvent.create).toHaveBeenCalledTimes(2);
    expect(db.applicationPublicUpdate.create).toHaveBeenCalledTimes(2);
    expect(db.recruitmentNotificationWork.create).toHaveBeenCalledTimes(2);
    expect(db.emailOutbox.create).toHaveBeenCalledTimes(2);
    expect(mocks.createInAppNotification).toHaveBeenCalledTimes(2);
    expect(mocks.appendAudit).toHaveBeenCalledTimes(2);
  });

  it("does not promote when capacity is unchanged or reduced", async () => {
    const unchangedDb = database({
      hiredCount: 1,
      waitlisted: [application("waitlisted", 90, "2026-08-01T00:00:00.000Z")],
    });
    const reducedDb = database({
      hiredCount: 2,
      waitlisted: [application("waitlisted", 90, "2026-08-01T00:00:00.000Z")],
    });

    await promoteWaitlistedApplicationsInTransaction({
      db: unchangedDb as never,
      jobPostingId: "job-1",
      previousCapacity: 2,
      newCapacity: 2,
      correlationId: "same-capacity",
    });
    await promoteWaitlistedApplicationsInTransaction({
      db: reducedDb as never,
      jobPostingId: "job-1",
      previousCapacity: 3,
      newCapacity: 2,
      correlationId: "reduced-capacity",
    });

    expect(unchangedDb.jobApplication.findMany).not.toHaveBeenCalled();
    expect(reducedDb.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it("keeps waitlisted out of ordinary recruiter transitions", () => {
    expect(canCapacityPromoteApplicationStage("WAITLISTED", "HIRED")).toBe(
      true,
    );
    expect(ordinaryApplicationTransitions.WAITLISTED).not.toContain("HIRED");
  });
});
