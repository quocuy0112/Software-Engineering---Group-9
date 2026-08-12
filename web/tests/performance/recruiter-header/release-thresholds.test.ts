import { describe, expect, it } from "vitest";
import {
  RECRUITER_HEADER_PROTOCOL,
  validateRecruiterHeaderMeasurement,
} from "../../../scripts/measure-recruiter-header-performance.mjs";

function validMeasurement() {
  const states = ["NEVER_APPLIED", "PENDING_REVIEW", "REJECTED", "APPROVED"];
  const accounts = states.flatMap((state) =>
    Array.from({ length: 25 }, (_, index) => ({
      id: state + "-" + index,
      state,
    })),
  );
  const cells = Object.fromEntries(
    ["interval", "focus", "visibility"].map((trigger) => [
      trigger,
      Object.fromEntries(states.map((state) => [state, 16])),
    ]),
  );
  return {
    accounts,
    pageLoad: { warmups: 20, measured: 200, p95Ms: 2500 },
    visibleRefresh: { warmups: 20, measured: 200, p95Ms: 1500 },
    concurrency: 20,
    refreshResultsByState: Object.fromEntries(
      states.map((state) => [state, 50]),
    ),
    triggerResults: { interval: 66, focus: 67, visibility: 67 },
    triggerResultCells: cells,
    intervalMs: RECRUITER_HEADER_PROTOCOL.intervalMinimumMs,
    renderedFrameBoundary: true,
    refreshLabelChange: true,
    percentileMethod: "nearest-rank",
    errorPercent: 0,
    overlap: false,
  };
}

describe("recruiter header release thresholds", () => {
  it("accepts the exact protocol shape", () => {
    expect(validateRecruiterHeaderMeasurement(validMeasurement()).ok).toBe(
      true,
    );
  });

  it("rejects under-sampled or unbounded measurements", () => {
    const measurement = validMeasurement();
    measurement.concurrency = 1;
    measurement.pageLoad.measured = 199;
    measurement.refreshResultsByState.APPROVED = 49;
    measurement.renderedFrameBoundary = false;
    expect(validateRecruiterHeaderMeasurement(measurement).ok).toBe(false);
  });
});
