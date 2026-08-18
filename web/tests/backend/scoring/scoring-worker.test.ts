import { describe, expect, it, vi } from "vitest";
import { ScoringWorker } from "@/backend/scoring/workers/scoring-worker";

describe("scoring worker automatic stage follow-up", () => {
  it("runs the application-scoped score rule after publication completes", async () => {
    const tx = {
      scoringWorkItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "work-1",
          operationId: "operation-1",
          jobApplicationId: "application-1",
          attemptCount: 1,
          application: { scoringGeneration: 3 },
        }),
        count: vi.fn().mockImplementation(async ({ where }) => {
          if (where?.state === "PUBLISHED") return 1;
          return 0;
        }),
      },
      scoringOperation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      jobApplication: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const db = {
      scoringWorkItem: {
        findFirst: vi.fn().mockResolvedValue({ id: "work-1" }),
      },
      $transaction: vi
        .fn()
        .mockImplementation(async (callback: (value: typeof tx) => unknown) =>
          callback(tx),
        ),
    };
    const automaticStageRule = vi.fn().mockResolvedValue(null);
    const worker = new ScoringWorker(
      db as never,
      vi.fn().mockResolvedValue("SCORED"),
      automaticStageRule,
    );

    await expect(
      worker.runOnce("worker-1", new Date("2026-08-18T12:00:00Z")),
    ).resolves.toMatchObject({ state: "SCORED", workItemId: "work-1" });
    expect(automaticStageRule).toHaveBeenCalledWith(
      expect.objectContaining({ candidateApplicationId: "application-1" }),
    );
  });
});
