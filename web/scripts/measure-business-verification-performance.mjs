import { performance } from "node:perf_hooks";
import { VietQrBusinessRegistryLookupAdapter } from "../src/backend/business-registry/vietqr-business-registry-adapter.ts";

const sampleSize = 200;
const taxIdentifier = "0316794479";
const payload = JSON.stringify({
  code: "00",
  data: {
    id: taxIdentifier,
    name: "Representative Company",
    address: "Ho Chi Minh City",
  },
});
const adapter = new VietQrBusinessRegistryLookupAdapter({
  fetcher: async () =>
    new Response(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  responseLimitBytes: 65_536,
});
const measurements = [];
let errors = 0;
for (let index = 0; index < sampleSize; index += 1) {
  const startedAt = performance.now();
  const result = await adapter.lookup(taxIdentifier).catch(() => null);
  measurements.push(performance.now() - startedAt);
  if (result?.outcome !== "MATCHED") errors += 1;
}
measurements.sort((left, right) => left - right);
const percentile = (value) =>
  measurements[Math.min(measurements.length - 1, Math.ceil(value * measurements.length) - 1)];
console.log(
  JSON.stringify(
    {
      environment: "local mocked public-provider contract",
      dataset: "one bounded VietQR-compatible response",
      sampleSize,
      concurrency: 1,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      maxMs: measurements.at(-1),
      errorRate: errors / sampleSize,
      externalServiceCondition: "network excluded; adapter overhead only",
    },
    null,
    2,
  ),
);
