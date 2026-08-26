import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("job post review performance harness", () => {
  const harness = readFileSync(
    "scripts/measure-job-post-review-performance.mjs",
    "utf8",
  );

  it("encodes the release thresholds and dataset shape", () => {
    expect(harness).toContain('const schemaVersion = "job-post-review-performance-v1"');
    expect(harness).toContain("notificationP95Ms: 5_000");
    expect(harness).toContain("interactionP95Ms: 2_000");
    expect(harness).toContain("managedJobs: 120");
    expect(harness).toContain("activeAdministrators: 3");
  });

  it("emits structured self-test evidence", () => {
    const run = spawnSync(process.execPath, [
      "scripts/measure-job-post-review-performance.mjs",
      "--self-test",
    ], { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report).toMatchObject({
      schemaVersion: "job-post-review-performance-v1",
      warmupRuns: 3,
      measuredSamples: 9,
      concurrency: 3,
      thresholds: {
        notificationP95Ms: 5000,
        interactionP95Ms: 2000,
      },
      metrics: {
        integritySuccessRate: 1,
        privacySuccessRate: 1,
        auditSuccessRate: 1,
      },
    });
    expect(report.metrics.notificationVisible.p95Ms).toBeLessThan(5000);
    expect(report.metrics.queueVisible.p95Ms).toBeLessThan(2000);
    expect(report.metrics.decisionVisible.p95Ms).toBeLessThan(2000);
  });
});
