import { describe, expect, it } from "vitest";

describe("messaging representative performance harness", () => {
  it("meets SC-002 and SC-005 over 100 conversations and 10,000 messages", async () => {
    const { measureMessagingPerformance } = await import(
      "../../../scripts/measure-messaging-performance.mjs"
    );
    const result = await measureMessagingPerformance({ samples: 100 });
    expect(result.environment.conversations).toBeGreaterThanOrEqual(100);
    expect(result.environment.messages).toBeGreaterThanOrEqual(10_000);
    expect(result.acceptedToPeerVisible.p95Ms).toBeLessThan(1_000);
    expect(result.conversationList.p95Ms).toBeLessThan(2_000);
    expect(result.messageHistory.p95Ms).toBeLessThan(2_000);
    expect(result.acceptedToPeerVisible.errorRate).toBeLessThan(0.01);
  });
});
