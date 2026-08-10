import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ModerationSubmissionService } from "@/backend/admin/moderation/moderation-submission-service";
import {
  createJobBoardDatabaseFixture,
  deleteJobBoardDatabaseFixture,
  type JobBoardDatabaseFixture,
} from "../../../helpers/job-board-database-fixture";

describe("moderation admission", () => {
  let fixture: JobBoardDatabaseFixture;
  beforeAll(async () => {
    fixture = await createJobBoardDatabaseFixture();
  });
  afterAll(async () => {
    await deleteJobBoardDatabaseFixture(fixture);
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
