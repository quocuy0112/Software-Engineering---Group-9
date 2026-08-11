import { fileURLToPath } from "node:url";

export const RECRUITER_HEADER_PROTOCOL = Object.freeze({
  accountMinimum: 100,
  accountsPerState: 25,
  warmups: 20,
  measured: 200,
  concurrency: 20,
  refreshResultsPerState: 50,
  triggerResults: 66,
  triggerResultCellMinimum: 16,
  triggerResultCellMaximum: 17,
  intervalMinimumMs: 30_000,
});

export function validateRecruiterHeaderMeasurement(measurement) {
  const errors = [];
  const protocol = RECRUITER_HEADER_PROTOCOL;
  const accounts = Array.isArray(measurement?.accounts)
    ? measurement.accounts
    : [];
  const counts = Object.fromEntries(
    ["NEVER_APPLIED", "PENDING_REVIEW", "REJECTED", "APPROVED"].map((state) => [
      state,
      accounts.filter((account) => account.state === state).length,
    ]),
  );
  if (accounts.length < protocol.accountMinimum) errors.push("accountMinimum");
  if (
    Object.values(counts).some((count) => count < protocol.accountsPerState)
  ) {
    errors.push("accountsPerState");
  }
  for (const kind of ["pageLoad", "visibleRefresh"]) {
    if (measurement?.[kind]?.warmups !== protocol.warmups) {
      errors.push(kind + ".warmups");
    }
    if (measurement?.[kind]?.measured !== protocol.measured) {
      errors.push(kind + ".measured");
    }
  }
  if (measurement?.concurrency !== protocol.concurrency)
    errors.push("concurrency");
  const refreshResults = measurement?.refreshResultsByState ?? {};
  for (const state of Object.keys(counts)) {
    if (refreshResults[state] !== protocol.refreshResultsPerState) {
      errors.push("refreshResults." + state);
    }
  }
  for (const trigger of ["interval", "focus", "visibility"]) {
    const count = measurement?.triggerResults?.[trigger];
    if (count !== 66 && count !== 67) errors.push("triggerResults." + trigger);
    const cells = measurement?.triggerResultCells?.[trigger] ?? {};
    for (const state of Object.keys(counts)) {
      const cell = cells[state];
      if (
        cell !== protocol.triggerResultCellMinimum &&
        cell !== protocol.triggerResultCellMaximum
      ) {
        errors.push("triggerResultCells." + trigger + "." + state);
      }
    }
  }
  if (
    measurement?.intervalMs !== undefined &&
    measurement.intervalMs < protocol.intervalMinimumMs
  ) {
    errors.push("intervalMinimumMs");
  }
  if (measurement?.renderedFrameBoundary !== true)
    errors.push("renderedFrameBoundary");
  if (measurement?.refreshLabelChange !== true)
    errors.push("refreshLabelChange");
  if (measurement?.percentileMethod !== "nearest-rank")
    errors.push("percentileMethod");
  if (measurement?.pageLoad?.p95Ms > 3000) errors.push("pageLoad.p95Ms");
  if (measurement?.visibleRefresh?.p95Ms > 2000)
    errors.push("visibleRefresh.p95Ms");
  if (measurement?.errorPercent > 0.5) errors.push("errorPercent");
  if (measurement?.overlap === true) errors.push("overlap");
  return { ok: errors.length === 0, errors, stateCounts: counts };
}

function printProtocol() {
  process.stdout.write(
    JSON.stringify(
      {
        protocol: RECRUITER_HEADER_PROTOCOL,
        note: "Collect authenticated Candidate sessions with rendered-frame boundaries; this command does not fabricate measurements.",
      },
      null,
      2,
    ) + "\n",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) printProtocol();
