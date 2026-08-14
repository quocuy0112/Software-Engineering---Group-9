import { performance } from "node:perf_hooks";

const group = process.argv
  .find((argument) => argument.startsWith("--group="))
  ?.slice("--group=".length) ?? "all";
const samples = 200;
const pageSize = 25;
let seed = 0x009f009;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
}
function timed(work) {
  const start = performance.now();
  work();
  return performance.now() - start;
}

function directoryBenchmark() {
  const accounts = Array.from({ length: 10_000 }, (_, index) => ({
    id: `account-${String(index).padStart(5, "0")}`,
    name: `Synthetic Account ${index}`,
    email: `account-${index}@example.test`,
    state: index % 11 === 0 ? "SUSPENDED" : "ACTIVE",
    type: index % 7 === 0 ? "RECRUITER" : "CANDIDATE",
    registeredAt: Date.UTC(2025, 0, 1) + index * 60_000,
  }));
  const durations = [];
  for (let sample = 0; sample < samples; sample++) {
    const needle = String(Math.floor(random() * 10_000)).padStart(5, "0");
    durations.push(timed(() => {
      const rows = accounts
        .filter((account) =>
          `${account.id} ${account.name} ${account.email}`.toLowerCase().includes(needle),
        )
        .sort((left, right) =>
          right.registeredAt - left.registeredAt || left.id.localeCompare(right.id),
        )
        .slice(0, pageSize);
      if (rows.length > pageSize) throw new Error("page bound violated");
    }));
  }
  return { fixtureRows: accounts.length, p95Ms: Number(percentile(durations, 0.95).toFixed(3)) };
}

function verificationBenchmark() {
  const requests = Array.from({ length: 1_000 }, (_, index) => ({
    id: `request-${index}`,
    state: index % 3 === 0 ? "PENDING_REVIEW" : "REJECTED",
    applicant: index % 13 === 0 ? "SUSPENDED" : "ACTIVE",
    submittedAt: index,
  }));
  const durations = [];
  for (let sample = 0; sample < samples; sample++) {
    durations.push(timed(() => requests
      .filter((request) => request.state === "PENDING_REVIEW" && request.applicant === "ACTIVE")
      .sort((left, right) => left.submittedAt - right.submittedAt)
      .slice(0, pageSize)));
  }
  return { fixtureRows: requests.length, p95Ms: Number(percentile(durations, 0.95).toFixed(3)) };
}

function moderationBenchmark() {
  const commands = Array.from({ length: 1_000 }, (_, index) => ({
    version: index + 1,
    reason: `Synthetic moderation reason ${index}`,
  }));
  const durations = [];
  for (let sample = 0; sample < samples; sample++) {
    durations.push(timed(() => commands.filter((command) => command.reason.length >= 10)));
  }
  return { fixtureRows: commands.length, p95Ms: Number(percentile(durations, 0.95).toFixed(3)) };
}

const result = {
  feature: "009",
  group,
  syntheticOnly: true,
  samples,
  note: "This deterministic smoke benchmark does not replace PostgreSQL EXPLAIN or the quickstart release fixture.",
  ...(group === "1" || group === "all" ? { directory: directoryBenchmark() } : {}),
  ...(group === "2" || group === "all" ? { verification: verificationBenchmark() } : {}),
  ...(group === "3" || group === "all" ? { moderation: moderationBenchmark() } : {}),
};
console.log(JSON.stringify(result, null, 2));
