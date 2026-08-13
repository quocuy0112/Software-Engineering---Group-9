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

  it("keeps the administrator review browser evidence-only", () => {
    const repository = readFileSync(
      "src/backend/repositories/admin/prisma-admin-messaging-report-repository.ts",
      "utf8",
    );
    expect(repository).toContain("evidenceMessage:");
    expect(repository).not.toMatch(/messages\s*:\s*\{/u);
    expect(repository).not.toMatch(
      /conversation\s*:\s*\{[\s\S]*?messages/u,
    );
  });
});
