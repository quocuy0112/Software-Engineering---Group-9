import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { VietQrBusinessRegistryLookupAdapter } from "@/backend/business-registry/vietqr-business-registry-adapter";

describe("business verification representative performance", () => {
  it("keeps bounded adapter overhead well below the external lookup SLA", async () => {
    const payload = JSON.stringify({
      code: "00",
      data: { id: "0316794479", name: "Example", address: "Ho Chi Minh City" },
    });
    const adapter = new VietQrBusinessRegistryLookupAdapter({
      fetcher: async () => new Response(payload, { status: 200 }),
      responseLimitBytes: 65_536,
    });
    const measurements: number[] = [];
    for (let index = 0; index < 200; index += 1) {
      const startedAt = performance.now();
      expect((await adapter.lookup("0316794479")).outcome).toBe("MATCHED");
      measurements.push(performance.now() - startedAt);
    }
    measurements.sort((left, right) => left - right);
    const p95 = measurements[Math.ceil(measurements.length * 0.95) - 1] ?? Infinity;
    expect(p95).toBeLessThan(100);
  });
});
