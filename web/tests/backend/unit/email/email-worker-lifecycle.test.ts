import { describe, expect, it, vi } from "vitest";
import {
  requestEmailWorkerStop,
  runEmailWorkerUntilStopped,
} from "@/backend/email/workers/email-worker-lifecycle";

describe("email worker lifecycle", () => {
  it("waits for in-flight delivery before disconnecting", async () => {
    let release!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const worker = { run, stop: vi.fn() };
    const disconnect = vi.fn().mockResolvedValue(undefined);

    const completion = runEmailWorkerUntilStopped(worker, disconnect);
    requestEmailWorkerStop(worker);

    expect(worker.stop).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
    release();
    await expect(completion).resolves.toBe(true);
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("disconnects after a worker failure and reports failure", async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    await expect(
      runEmailWorkerUntilStopped(
        {
          run: vi.fn().mockRejectedValue(new Error("private provider error")),
          stop: vi.fn(),
        },
        disconnect,
      ),
    ).resolves.toBe(false);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
