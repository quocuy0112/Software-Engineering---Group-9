import { performance } from "node:perf_hooks";

const samples = Number(process.env.CONNECTION_PERF_SAMPLES ?? 10_000);
const started = performance.now();
const rows = Array.from({ length: samples }, (_, index) => ({ id: `proposal-${index}`, state: index % 2 ? "ACCEPTED" : "PENDING_BOTH", updatedAt: samples - index }));
rows.sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
const durationMs = performance.now() - started;
console.log(JSON.stringify({ scenario: "deterministic-proposal-projection", samples, durationMs: Number(durationMs.toFixed(2)), budgetMs: 2_000, passed: durationMs <= 2_000 }));
if (durationMs > 2_000) process.exitCode = 1;
