import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ReportMessagingService } from "@/backend/messaging/services/report-messaging";

describe("messaging report privacy boundary", () => {
  it("returns the same neutral receipt for a deduplicated report and keeps content out of audit", async () => {
    let audited: unknown;
    const append = vi.fn(async (input: unknown) => {
      audited = input;
      return "audit-1";
    });
    const service = new ReportMessagingService(
      {
        submit: async () => ({ reportId: "report-1", deduplicated: true }),
      } as never,
      { append } as never,
    );
    const receipt = await service.execute(
      { userId: "reporter", sessionId: "session" },
      {
        conversationId: "conversation-1",
        targetUserId: "target",
        targetType: "CONVERSATION",
        category: "ABUSE_OR_THREATS",
        detail: "Private evidence content must not enter audit.",
      },
      new Date(0),
    );
    expect(receipt).toEqual({ receipt: "REPORT_RECEIVED" });
    expect(audited).not.toHaveProperty("context.detail");
  });

  it("does not add a messaging report or message browser to the current admin API", () => {
    const adminRoutes = readFileSync("src/backend/admin/dashboard/dashboard-definition.ts", "utf8");
    expect(adminRoutes).not.toMatch(/messagingReport|messagingMessage/u);
  });
});
