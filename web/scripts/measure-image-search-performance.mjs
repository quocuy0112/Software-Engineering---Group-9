import { readFile } from "node:fs/promises";
import os from "node:os";
import process from "node:process";

const SCHEMA = "image-search-performance-v2";
const CONCURRENCY_MATRIX = [1, 2, 4];
const STRATEGIES = [
  "BASELINE",
  "FULL_ONLY",
  "ADAPTIVE_TILE_10",
  "ADAPTIVE_TILE_15",
  "ADAPTIVE_TILE_20",
  "TILE_ONLY",
];
const STRATA = ["EASY", "TINY_TEXT", "DENSE", "MULTI_COLUMN", "NO_TEXT"];
const SAMPLE_FIELDS = [
  "id",
  "condition",
  "concurrency",
  "strategy",
  "stratum",
  "queueToActionableMs",
  "ocrMs",
  "interpretationMs",
  "deterministicSearchMs",
  "cpuPeakPercent",
  "memoryPeakBytes",
  "cropBytesPeak",
  "detectedRegions",
  "selectedRegions",
  "skippedRegions",
  "outcome",
];

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
    ] ?? null
  );
}

function latencySummary(samples, field) {
  const values = samples.map((sample) => sample[field]);
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maximumMs: Math.max(...values),
    errorRate:
      samples.filter((sample) => sample.outcome === "ERROR").length /
      samples.length,
  };
}

function numericSummary(samples, field) {
  const values = samples.map((sample) => sample[field]);
  return {
    samples: values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    maximum: Math.max(...values),
  };
}

function validate(input) {
  if (
    input.schemaVersion !== SCHEMA ||
    !["MEASURED", "SELF_TEST"].includes(input.mode)
  )
    throw new Error("IMAGE_SEARCH_PERF_SCHEMA_INVALID");
  if (
    input.metadata?.ocrDeadlineMs !== 10_000 ||
    JSON.stringify(input.metadata?.concurrencyMatrix) !==
      JSON.stringify(CONCURRENCY_MATRIX) ||
    !Array.isArray(input.metadata?.strategies) ||
    input.metadata.strategies.some((strategy) => !STRATEGIES.includes(strategy))
  )
    throw new Error("IMAGE_SEARCH_PERF_CONDITIONS_INVALID");
  if (!Array.isArray(input.samples))
    throw new Error("IMAGE_SEARCH_PERF_SAMPLES_REQUIRED");
  const ids = new Set();
  for (const sample of input.samples) {
    if (
      Object.keys(sample).sort().join() !== SAMPLE_FIELDS.slice().sort().join()
    )
      throw new Error("IMAGE_SEARCH_PERF_SAMPLE_CONTENT_FORBIDDEN");
    if (ids.has(sample.id))
      throw new Error("IMAGE_SEARCH_PERF_DUPLICATE_SAMPLE");
    ids.add(sample.id);
    if (
      !["COLD", "WARM"].includes(sample.condition) ||
      !CONCURRENCY_MATRIX.includes(sample.concurrency) ||
      !STRATEGIES.includes(sample.strategy) ||
      !input.metadata.strategies.includes(sample.strategy) ||
      !STRATA.includes(sample.stratum) ||
      !["ACTIONABLE", "ERROR"].includes(sample.outcome)
    )
      throw new Error("IMAGE_SEARCH_PERF_SAMPLE_INVALID");
    for (const field of [
      "queueToActionableMs",
      "ocrMs",
      "interpretationMs",
      "deterministicSearchMs",
      "cpuPeakPercent",
      "memoryPeakBytes",
      "cropBytesPeak",
      "detectedRegions",
      "selectedRegions",
      "skippedRegions",
    ]) {
      if (!Number.isFinite(sample[field]) || sample[field] < 0)
        throw new Error("IMAGE_SEARCH_PERF_SAMPLE_INVALID");
    }
    for (const field of [
      "concurrency",
      "detectedRegions",
      "selectedRegions",
      "skippedRegions",
    ])
      if (!Number.isInteger(sample[field]))
        throw new Error("IMAGE_SEARCH_PERF_SAMPLE_INVALID");
    if (
      sample.selectedRegions > sample.detectedRegions ||
      sample.skippedRegions !== sample.detectedRegions - sample.selectedRegions
    )
      throw new Error("IMAGE_SEARCH_PERF_REGION_ACCOUNTING_INVALID");
  }
  const warm = input.samples.filter((sample) => sample.condition === "WARM");
  const cold = input.samples.filter((sample) => sample.condition === "COLD");
  if (warm.length < 100 || cold.length < 1)
    throw new Error("IMAGE_SEARCH_PERF_SAMPLE_FLOOR_NOT_MET");
  return { warm, cold };
}

function groupedReport(samples) {
  const groups = new Map();
  for (const sample of samples) {
    const key = `${sample.strategy}@${sample.concurrency}`;
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  return Object.fromEntries(
    [...groups.entries()].map(([key, group]) => [
      key,
      {
        samples: group.length,
        queueToActionable: latencySummary(group, "queueToActionableMs"),
        ocr: latencySummary(group, "ocrMs"),
        interpretation: latencySummary(group, "interpretationMs"),
        deterministicSearch: latencySummary(group, "deterministicSearchMs"),
        cpuPeakPercent: numericSummary(group, "cpuPeakPercent"),
        memoryPeakBytes: numericSummary(group, "memoryPeakBytes"),
        cropBytesPeak: numericSummary(group, "cropBytesPeak"),
        detectedRegions: numericSummary(group, "detectedRegions"),
        selectedRegions: numericSummary(group, "selectedRegions"),
        skippedRegions: numericSummary(group, "skippedRegions"),
      },
    ]),
  );
}

function report(input) {
  const { warm, cold } = validate(input);
  const actionableWithin10s =
    warm.filter(
      (sample) =>
        sample.outcome === "ACTIONABLE" && sample.queueToActionableMs <= 10_000,
    ).length / warm.length;
  const searchWithin2s =
    warm.filter(
      (sample) =>
        sample.outcome === "ACTIONABLE" &&
        sample.deterministicSearchMs <= 2_000,
    ).length / warm.length;
  const hardDeadlineMet = input.samples.every(
    (sample) => sample.ocrMs <= 10_000,
  );
  const resourceLimitsMet = input.samples.every(
    (sample) =>
      sample.memoryPeakBytes <=
        (input.metadata.memoryLimitBytes ?? 8 * 1024 * 1024 * 1024) &&
      sample.cropBytesPeak <=
        (input.metadata.cropBatchLimitBytes ?? 16 * 1024 * 1024) &&
      sample.cpuPeakPercent <= (input.metadata.cpuLimitPercent ?? 400),
  );
  const passed =
    actionableWithin10s >= 0.95 &&
    searchWithin2s >= 0.95 &&
    hardDeadlineMet &&
    resourceLimitsMet;
  return {
    schemaVersion: SCHEMA,
    mode: input.mode,
    releaseEvidenceEligible: input.mode === "MEASURED",
    releaseGatePassed: input.mode === "MEASURED" && passed,
    passed,
    percentileMethod: "nearest-rank",
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      ...input.metadata,
    },
    cold: {
      queueToActionable: latencySummary(cold, "queueToActionableMs"),
      ocr: latencySummary(cold, "ocrMs"),
      interpretation: latencySummary(cold, "interpretationMs"),
      deterministicSearch: latencySummary(cold, "deterministicSearchMs"),
      cpuPeakPercent: numericSummary(cold, "cpuPeakPercent"),
      memoryPeakBytes: numericSummary(cold, "memoryPeakBytes"),
      cropBytesPeak: numericSummary(cold, "cropBytesPeak"),
    },
    warm: {
      queueToActionable: latencySummary(warm, "queueToActionableMs"),
      ocr: latencySummary(warm, "ocrMs"),
      interpretation: latencySummary(warm, "interpretationMs"),
      deterministicSearch: latencySummary(warm, "deterministicSearchMs"),
      cpuPeakPercent: numericSummary(warm, "cpuPeakPercent"),
      memoryPeakBytes: numericSummary(warm, "memoryPeakBytes"),
      cropBytesPeak: numericSummary(warm, "cropBytesPeak"),
    },
    byStrategyAndConcurrency: groupedReport(input.samples),
    gates: {
      actionableWithin10s,
      searchWithin2s,
      hardDeadlineMet,
      resourceLimitsMet,
    },
  };
}

function selfTest() {
  const sample = (id, condition) => ({
    id,
    condition,
    concurrency: 4,
    strategy: "ADAPTIVE_TILE_15",
    stratum: "EASY",
    queueToActionableMs: condition === "COLD" ? 8_700 : 1_900,
    ocrMs:
      condition === "COLD"
        ? 5_500
        : 1_400 + (Number(id.replace(/\D/gu, "")) % 200),
    interpretationMs: condition === "COLD" ? 7_200 : 2_100,
    deterministicSearchMs: condition === "COLD" ? 1_200 : 220,
    cpuPeakPercent: 230,
    memoryPeakBytes: 512 * 1024 * 1024,
    cropBytesPeak: 4 * 1024 * 1024,
    detectedRegions: 12,
    selectedRegions: 12,
    skippedRegions: 0,
    outcome: "ACTIONABLE",
  });
  return {
    schemaVersion: SCHEMA,
    mode: "SELF_TEST",
    metadata: {
      concurrency: 4,
      concurrencyMatrix: CONCURRENCY_MATRIX,
      ocrDeadlineMs: 10_000,
      memoryLimitBytes: 8 * 1024 * 1024 * 1024,
      cropBatchLimitBytes: 16 * 1024 * 1024,
      cpuLimitPercent: 400,
      strategies: STRATEGIES,
      engine: "paddleocr-onnx@1.1.0",
      model: "PP-OCRv6-medium",
      strategyVersion: "search-ocr-adaptive-tiles-v1",
      interpreter: "deterministic-v1",
      storage: "synthetic-memory",
    },
    samples: [
      sample("cold-1", "COLD"),
      ...Array.from({ length: 100 }, (_, index) =>
        sample(`warm-${index + 1}`, "WARM"),
      ),
    ],
  };
}

const args = process.argv.slice(2);
let input;
if (args.length === 1 && args[0] === "--self-test") input = selfTest();
else if (args.length === 2 && args[0] === "--input")
  input = JSON.parse(await readFile(args[1], "utf8"));
else
  throw new Error(
    "Usage: measure-image-search-performance.mjs --self-test | --input <json>",
  );
const result = report(input);
console.log(
  `IMAGE_SEARCH_PERFORMANCE_RESULT\n${JSON.stringify(result, null, 2)}`,
);
if (!result.passed) throw new Error("IMAGE_SEARCH_PERFORMANCE_GATE_FAILED");
