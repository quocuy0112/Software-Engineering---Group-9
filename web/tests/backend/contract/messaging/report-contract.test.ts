import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  messagingReportInputSchema,
  reportReceiptSchema,
} from "@/shared/contracts/messaging/safety";
import { messagingJson } from "@/backend/messaging/http/messaging-route";

describe("messaging report contract", () => {
  it("validates category, optional same-conversation evidence reference, and Other detail", () => {
    expect(
      messagingReportInputSchema.parse({
        conversationId: "conversation-1",
        targetUserId: "user-b",
        targetType: "CONVERSATION",
        evidenceMessageId: "message-1",
        category: "ABUSE_OR_THREATS",
      }).evidenceMessageId,
    ).toBe("message-1");
    expect(() =>
      messagingReportInputSchema.parse({
        conversationId: "conversation-1",
        targetUserId: "user-b",
        targetType: "PARTICIPANT",
        category: "OTHER",
        detail: "short",
      }),
    ).toThrow();
  });

  it("returns one neutral receipt and no-store", () => {
    expect(reportReceiptSchema.parse({ receipt: "REPORT_RECEIVED" })).toEqual({
      receipt: "REPORT_RECEIVED",
    });
    expect(messagingJson({ receipt: "REPORT_RECEIVED" }).headers.get("cache-control")).toContain(
      "no-store",
    );
    expect(readFileSync("src/app/api/messaging/reports/route.ts", "utf8")).toContain(
      "export async function POST",
    );
  });
});
