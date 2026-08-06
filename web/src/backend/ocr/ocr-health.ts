import "server-only";

import type { OcrEngine } from "./ocr-engine";

export type OcrPurposeAvailability = Readonly<{
  live: boolean;
  ready: boolean;
  manifestMatches: boolean;
  cvHybridAvailable: boolean;
  imageSearchAvailable: boolean;
  checkedAt: Date;
}>;

export class CachedOcrHealth {
  private cached: OcrPurposeAvailability | null = null;

  constructor(
    private readonly dependencies: Readonly<{
      engine: OcrEngine;
      expectedManifestSha256: string;
      enabled: boolean;
      now(): Date;
      ttlMs?: number;
    }>,
  ) {}

  async current(): Promise<OcrPurposeAvailability> {
    const now = this.dependencies.now();
    if (
      this.cached &&
      now.getTime() - this.cached.checkedAt.getTime() <
        (this.dependencies.ttlMs ?? 15_000)
    )
      return this.cached;
    let ready = false;
    if (this.dependencies.enabled)
      ready = await this.dependencies.engine
        .assertReady(this.dependencies.expectedManifestSha256)
        .then(() => true)
        .catch(() => false);
    this.cached = Object.freeze({
      live: ready,
      ready,
      manifestMatches: ready,
      cvHybridAvailable: ready,
      imageSearchAvailable: ready,
      checkedAt: now,
    });
    return this.cached;
  }
}
