import "server-only";

import type {
  ImageSearchWorkClaim,
  ImageSearchWorkStage,
} from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import type { createImageSearchWorkerResources } from "./resource-factory";
import { ImageSearchWorkerPipeline } from "./pipeline";

type Resources = ReturnType<typeof createImageSearchWorkerResources>;
const STAGES: readonly ImageSearchWorkStage[] = [
  "SCAN",
  "DECODE",
  "OCR",
  "INTERPRET",
];
export const IMAGE_SEARCH_OCR_LEASE_MS = 30_000;

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export class ImageSearchWorkerRuntime {
  private readonly controller = new AbortController();
  private readonly pipeline: ImageSearchWorkerPipeline;
  private readonly active = new Set<Promise<void>>();
  private stopping = false;
  private lastMaintenanceAt = 0;

  constructor(
    private readonly resources: Resources,
    private readonly options: Readonly<{
      concurrency?: number;
      leaseMs?: number;
      pollMs?: number;
      maintenanceMs?: number;
      processStages?: boolean;
    }> = {},
  ) {
    const leaseMs = options.leaseMs ?? IMAGE_SEARCH_OCR_LEASE_MS;
    if (!Number.isFinite(leaseMs) || leaseMs < IMAGE_SEARCH_OCR_LEASE_MS) {
      throw new Error("IMAGE_SEARCH_OCR_LEASE_TOO_SHORT");
    }
    this.pipeline = new ImageSearchWorkerPipeline(resources);
  }

  private track(claim: ImageSearchWorkClaim) {
    const operation = this.pipeline
      .process(claim, new Date(), this.controller.signal)
      .catch((error) => {
        if ((error as Error).message !== "STAGE_RESULT_DISCARDED")
          console.error(
            JSON.stringify({
              event: "image_search_stage_failed",
              stage: claim.stage,
              code: "STAGE_FAILED",
            }),
          );
      })
      .finally(() => this.active.delete(operation));
    this.active.add(operation);
  }

  async pollOnce(now = new Date()) {
    const concurrency = this.options.concurrency ?? 4;
    if (
      now.getTime() - this.lastMaintenanceAt >=
      (this.options.maintenanceMs ?? 10_000)
    ) {
      await this.resources.reconciliation.runOnce(now);
      await this.resources.cleanup.runOnce(now);
      this.lastMaintenanceAt = now.getTime();
    }
    if (this.options.processStages === false) return 0;
    let claimed = 0;
    for (const stage of STAGES) {
      const capacity = concurrency - this.active.size;
      if (capacity <= 0) break;
      const rows = await this.resources.work.claimStage({
        stage,
        owner: this.resources.owner,
        now,
        leaseMs: this.options.leaseMs ?? IMAGE_SEARCH_OCR_LEASE_MS,
        limit: capacity,
      });
      claimed += rows.length;
      rows.forEach((row) => this.track(row));
    }
    return claimed;
  }

  async run() {
    await this.resources.storage.storage.assertReady();
    while (!this.stopping && !this.controller.signal.aborted) {
      const claimed = await this.pollOnce();
      if (this.active.size) await Promise.race(this.active);
      else if (!claimed)
        await delay(this.options.pollMs ?? 500, this.controller.signal);
    }
    await this.shutdown();
  }

  async shutdown() {
    if (!this.stopping) {
      this.stopping = true;
      this.controller.abort();
    }
    await Promise.allSettled([...this.active]);
    await this.resources.work.releaseOwner(this.resources.owner, new Date());
  }
}
