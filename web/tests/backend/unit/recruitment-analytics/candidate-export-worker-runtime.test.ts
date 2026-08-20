import { describe, expect, it, vi } from "vitest";
import { CandidateExportWorkerRuntime } from "@/backend/exports/candidate-export-worker-runtime";
import type { CandidateExportWorker } from "@/backend/exports/candidate-export-worker";

describe("candidate export worker runtime", () => {
  it("drains available requests and can be stopped", async () => {
    let calls = 0;
    const worker = {
      runOnce: vi.fn(async () => {
        calls += 1;
        return calls < 3;
      }),
    } as unknown as CandidateExportWorker;
    const runtime = new CandidateExportWorkerRuntime(worker);

    runtime.start(60_000);
    await vi.waitFor(() => expect(worker.runOnce).toHaveBeenCalledTimes(3));
    runtime.stop();

    expect(calls).toBe(3);
  });
});
