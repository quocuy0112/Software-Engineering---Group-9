import { describe, expect, it, vi } from "vitest";
import { PrivateCvMatchService } from "@/backend/private-cv-match/private-cv-match-service";

describe("private CV match retry service", () => {
  it("accepts a retry when another request wins the retry race", async () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    const report = {
      id: "pmc-1",
      attempts: [
        {
          trigger: "AI_RETRY",
          state: "QUEUED",
          leaseExpiresAt: null,
        },
      ],
    };
    const repository = {
      findCommandReceipt: vi.fn().mockResolvedValue(null),
      findOwnedCheck: vi
        .fn()
        .mockResolvedValueOnce({ id: "pmc-1", attempts: [] })
        .mockResolvedValueOnce(report),
      withTransaction: vi.fn(
        async (operation: (transaction: unknown) => Promise<unknown>) =>
          operation({
            createAiRetryAttempt: async () => {
              throw new Error("PRIVATE_RETRY_NOT_ALLOWED");
            },
            createCommandReceipt: vi.fn(),
          }),
      ),
    };
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const service = new PrivateCvMatchService({
      repository: repository as never,
      enqueue,
      now: () => now,
    });

    await expect(
      service.retryAi("candidate-a", "pmc-1", "retry-key-123456"),
    ).resolves.toEqual({ check: report, replay: false });
    expect(enqueue).toHaveBeenCalledWith("pmc-1");
  });
});
