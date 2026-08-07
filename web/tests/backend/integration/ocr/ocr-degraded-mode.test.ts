import { describe, expect, it, vi } from "vitest";

import { CachedOcrHealth } from "@/backend/ocr/ocr-health";
import type { OcrEngine } from "@/backend/ocr/ocr-engine";

function engine(assertReady: OcrEngine["assertReady"]): OcrEngine {
  return {
    assertReady,
    recognize: vi.fn(),
  };
}

describe("OCR degraded-mode health", () => {
  it("reports both OCR purposes unavailable without probing when disabled", async () => {
    const assertReady = vi.fn();
    const health = new CachedOcrHealth({
      engine: engine(assertReady),
      expectedManifestSha256: "a".repeat(64),
      enabled: false,
      now: () => new Date("2026-08-06T00:00:00.000Z"),
    });

    await expect(health.current()).resolves.toMatchObject({
      live: false,
      ready: false,
      manifestMatches: false,
      cvHybridAvailable: false,
      imageSearchAvailable: false,
    });
    expect(assertReady).not.toHaveBeenCalled();
  });

  it("fails closed on socket or manifest readiness errors and caches content-free state", async () => {
    const assertReady = vi.fn().mockRejectedValue(new Error("private details"));
    const now = vi.fn(() => new Date("2026-08-06T00:00:00.000Z"));
    const health = new CachedOcrHealth({
      engine: engine(assertReady),
      expectedManifestSha256: "b".repeat(64),
      enabled: true,
      now,
      ttlMs: 15_000,
    });

    const first = await health.current();
    const second = await health.current();
    expect(first).toEqual(second);
    expect(first).toMatchObject({ live: false, ready: false });
    expect(JSON.stringify(first)).not.toContain("private details");
    expect(assertReady).toHaveBeenCalledOnce();
  });

  it("makes hybrid/search OCR available only after exact readiness succeeds", async () => {
    const assertReady = vi.fn().mockResolvedValue(undefined);
    const health = new CachedOcrHealth({
      engine: engine(assertReady),
      expectedManifestSha256: "c".repeat(64),
      enabled: true,
      now: () => new Date("2026-08-06T00:00:00.000Z"),
    });

    await expect(health.current()).resolves.toMatchObject({
      live: true,
      ready: true,
      manifestMatches: true,
      cvHybridAvailable: true,
      imageSearchAvailable: true,
    });
    expect(assertReady).toHaveBeenCalledWith("c".repeat(64));
  });
});
