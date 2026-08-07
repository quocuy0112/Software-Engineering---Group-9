import "server-only";

import type { ImageSearchWorkClaim } from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import type { createImageSearchWorkerResources } from "./resource-factory";

type Resources = ReturnType<typeof createImageSearchWorkerResources>;

export class ImageSearchWorkerPipeline {
  constructor(private readonly resources: Resources) {}

  process(claim: ImageSearchWorkClaim, now: Date, signal: AbortSignal) {
    switch (claim.stage) {
      case "SCAN":
        return this.resources.stages.SCAN.process(claim, now);
      case "DECODE":
        return this.resources.stages.DECODE.process(claim, now, signal);
      case "OCR":
        return this.resources.stages.OCR.process(claim, now, signal);
      case "INTERPRET":
        return this.resources.stages.INTERPRET.process(claim, now, signal);
    }
  }
}
