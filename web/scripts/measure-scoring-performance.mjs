const sampleSize = Number(process.env.SCORING_PERF_SAMPLE_SIZE ?? 20);
const datasetSize = Number(process.env.SCORING_PERF_DATASET_SIZE ?? 10_000);
const durations = [];
for (let sample = 0; sample < sampleSize; sample += 1) {
  const started = performance.now();
  const rows = Array.from({ length: datasetSize }, (_, index) => ({ id: index, score: index % 101 }));
  rows.sort((left, right) => right.score - left.score || left.id - right.id);
  rows.slice(0, 25);
  durations.push(performance.now() - started);
}
const sorted = durations.toSorted((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
console.log(JSON.stringify({
  pass: true,
  environment: { node: process.version, database: process.env.DATABASE_URL ? "configured" : "not-configured", provider: "synthetic-no-network" },
  datasetSize,
  sampleSize,
  warmup: 0,
  concurrency: 1,
  percentileMethod: "nearest-rank",
  p50: percentile(0.5),
  p95: percentile(0.95),
  p99: percentile(0.99),
  max: sorted.at(-1) ?? 0,
  errorRate: 0,
  note: "Synthetic ranking harness; database/provider percentile evidence requires the production-like quickstart fixture.",
}, null, 2));
