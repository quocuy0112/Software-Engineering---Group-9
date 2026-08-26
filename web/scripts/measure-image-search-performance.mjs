import { readFile } from "node:fs/promises";
import os from "node:os";
import process from "node:process";

const SCHEMA = "image-search-performance-v1";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
    ] ?? null
  );
}

function summary(samples, field) {
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

function validate(input) {
  if (
    input.schemaVersion !== SCHEMA ||
    !["MEASURED", "SELF_TEST"].includes(input.mode)
  )
    throw new Error("IMAGE_SEARCH_PERF_SCHEMA_INVALID");
  if (
    input.metadata?.concurrency !== 4 ||
    input.metadata?.ocrDeadlineMs !== 10_000
  )
    throw new Error("IMAGE_SEARCH_PERF_CONDITIONS_INVALID");
  if (!Array.isArray(input.samples))
    throw new Error("IMAGE_SEARCH_PERF_SAMPLES_REQUIRED");
  const ids = new Set();
  for (const sample of input.samples) {
    const exact = [
      "id",
      "condition",
      "ocrMs",
      "interpretationMs",
      "deterministicSearchMs",
      "outcome",
    ];
    if (Object.keys(sample).sort().join() !== exact.sort().join())
      throw new Error("IMAGE_SEARCH_PERF_SAMPLE_CONTENT_FORBIDDEN");
    if (ids.has(sample.id))
      throw new Error("IMAGE_SEARCH_PERF_DUPLICATE_SAMPLE");
    ids.add(sample.id);
    if (
      !["COLD", "WARM"].includes(sample.condition) ||
      !["ACTIONABLE", "ERROR"].includes(sample.outcome)
    )
      throw new Error("IMAGE_SEARCH_PERF_SAMPLE_INVALID");
    for (const field of ["ocrMs", "interpretationMs", "deterministicSearchMs"])
      if (!Number.isFinite(sample[field]) || sample[field] < 0)
        throw new Error("IMAGE_SEARCH_PERF_SAMPLE_INVALID");
  }
  const warm = input.samples.filter((sample) => sample.condition === "WARM");
  const cold = input.samples.filter((sample) => sample.condition === "COLD");
  if (warm.length < 100 || cold.length < 1)
    throw new Error("IMAGE_SEARCH_PERF_SAMPLE_FLOOR_NOT_MET");
  return { warm, cold };
}

function report(input) {
  const { warm, cold } = validate(input);
  const actionableWithin10s =
    warm.filter(
      (sample) =>
        sample.outcome === "ACTIONABLE" && sample.interpretationMs <= 10_000,
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
  const passed =
    actionableWithin10s >= 0.95 && searchWithin2s >= 0.95 && hardDeadlineMet;
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
      ocr: summary(cold, "ocrMs"),
      interpretation: summary(cold, "interpretationMs"),
      deterministicSearch: summary(cold, "deterministicSearchMs"),
    },
    warm: {
      ocr: summary(warm, "ocrMs"),
      interpretation: summary(warm, "interpretationMs"),
      deterministicSearch: summary(warm, "deterministicSearchMs"),
    },
    gates: { actionableWithin10s, searchWithin2s, hardDeadlineMet },
  };
}

function selfTest() {
  const sample = (id, condition) => ({
    id,
    condition,
    ocrMs:
      condition === "COLD"
        ? 5_500
        : 1_400 + (Number(id.replace(/\D/gu, "")) % 200),
    interpretationMs: condition === "COLD" ? 7_200 : 2_100,
    deterministicSearchMs: condition === "COLD" ? 1_200 : 220,
    outcome: "ACTIONABLE",
  });
  return {
    schemaVersion: SCHEMA,
    mode: "SELF_TEST",
    metadata: {
      concurrency: 4,
      ocrDeadlineMs: 10_000,
      engine: "paddleocr-onnx@1.0.0",
      model: "PP-OCRv6-medium",
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
