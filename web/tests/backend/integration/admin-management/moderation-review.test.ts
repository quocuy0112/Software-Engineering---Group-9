import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { ModerationReviewService } from "@/backend/admin/moderation/moderation-review-service";
const suffix = crypto.randomUUID();
const reporter = `moderation-reporter-${suffix}`;
const reportId = `moderation-report-${suffix}`;
const authority = {
  userId: `admin-${suffix}`,
  sessionId: `session-${suffix}`,
  grantId: `grant-${suffix}`,
  proofAt: new Date(),
};
describe("moderation review lifecycle", () => {
  beforeEach(async () => {
    await prisma.userAccount.create({
      data: {
        id: reporter,
        name: "Reporter",
        email: `${reporter}@example.test`,
        normalizedEmail: `${reporter}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
    await prisma.moderationReport.create({
      data: {
        id: reportId,
        reporterUserId: reporter,
        targetType: "COMPANY",
        targetReference: "company-reference",
        qualifyingRelationship: { kind: "test" },
        category: "OTHER",
        priority: "NORMAL",
        unresolvedKey: `unresolved-${suffix}`,
      },
    });
  });
  afterEach(async () => {
    await prisma.adminCommandReceipt.deleteMany({
      where: { targetReference: reportId },
    });
    await prisma.moderationReport.deleteMany({ where: { id: reportId } });
    await prisma.userAccount.delete({ where: { id: reporter } });
  });
  const command = (version: number) => ({
    expectedVersion: version,
    idempotencyKey: crypto.randomUUID(),
  });
  it("assigns, notes, and reaches one terminal state with immutable history", async () => {
    const service = new ModerationReviewService();
    await service.execute(authority, reportId, "assign", command(1));
    await service.execute(authority, reportId, "note", {
      ...command(2),
      note: "  Investigated <b>company</b> evidence.  ",
    });
    await service.execute(authority, reportId, "resolve", command(3));
    const row = await prisma.moderationReport.findUniqueOrThrow({
      where: { id: reportId },
      include: { history: true, notes: true },
    });
    expect(row.state).toBe("RESOLVED");
    expect(row.unresolvedKey).toBeNull();
    expect(row.notes[0]?.normalizedText).toBe("Investigated company evidence.");
    expect(row.history).toHaveLength(3);
    await expect(
      service.execute(authority, reportId, "dismiss", command(4)),
    ).rejects.toThrow("INVALID_STATE");
    expect(
      await prisma.securityNotificationWork.count({
        where: {
          originatingCorrelationId: {
            in: row.history.map((item) => item.enforcementCorrelationId ?? ""),
          },
        },
      }),
    ).toBe(0);
  });
});
