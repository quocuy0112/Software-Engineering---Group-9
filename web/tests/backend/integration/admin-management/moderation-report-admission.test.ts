import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { ModerationSubmissionService } from "@/backend/admin/moderation/moderation-submission-service";
import {
  createJobBoardDatabaseFixture,
  deleteJobBoardDatabaseFixture,
  type JobBoardDatabaseFixture,
} from "../../../helpers/job-board-database-fixture";

describe("moderation admission", () => {
  let fixture: JobBoardDatabaseFixture;
  const adminId = `moderation-notification-admin-${crypto.randomUUID()}`;
  beforeAll(async () => {
    fixture = await createJobBoardDatabaseFixture();
    await prisma.userAccount.create({
      data: {
        id: adminId,
        name: "Moderation Notification Admin",
        email: `${adminId}@example.test`,
        normalizedEmail: `${adminId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
        platformAdministratorGrants: { create: {} },
      },
    });
  });
  afterAll(async () => {
    await deleteJobBoardDatabaseFixture(fixture);
    await prisma.platformAdministratorGrant.deleteMany({
      where: { userId: adminId },
    });
    await prisma.userAccount.deleteMany({ where: { id: adminId } });
  });
  it("deduplicates a reporter/target/category during the rolling day with a neutral receipt", async () => {
    const actor = { userId: fixture.userIds[0]!, sessionId: "session-a" };
    const input = {
      target: { type: "JOB", reference: fixture.jobs.active.id },
      category: "MISLEADING_CONTENT",
      detail: "The public listing contains misleading terms.",
    };
    const first = await new ModerationSubmissionService().submitActor(
      actor,
      input,
      fixture.now,
    );
    const second = await new ModerationSubmissionService().submitActor(
      { ...actor, sessionId: "session-b" },
      input,
      new Date(fixture.now.getTime() + 1_000),
    );
    expect(first.created).toBe(true);
    expect(second).toMatchObject({
      created: false,
      duplicate: true,
      message: "Thanks. Your concern was received for review.",
    });
    expect(
      await prisma.inAppNotification.findMany({
        where: {
          recipientUserId: adminId,
          kind: "MODERATION_REPORT_RECEIVED_ADMIN" as never,
          contextId: first.reportId,
        },
      }),
    ).toHaveLength(1);
  });
  it("returns the same unavailable outcome for an unknown public target", async () => {
    await expect(
      new ModerationSubmissionService().submitActor(
        { userId: fixture.userIds[0]!, sessionId: "session" },
        {
          target: { type: "JOB", reference: "unknown" },
          category: "SPAM_OR_DUPLICATE",
        },
        fixture.now,
      ),
    ).rejects.toThrow("REPORT_TARGET_UNAVAILABLE");
  });
});
