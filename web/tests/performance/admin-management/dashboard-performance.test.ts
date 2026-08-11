import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SC-002 dashboard performance harness", () => {
  it("enforces 95% within two seconds and less than 1% errors", () => {
    const run = spawnSync(
      process.execPath,
      [
        resolve(
          process.cwd(),
          "scripts/measure-admin-management-performance.mjs",
        ),
        "--self-test",
      ],
      { encoding: "utf8" },
    );
    expect(run.status, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report.dashboard.usableWithinTwoSecondsRate).toBeGreaterThanOrEqual(
      0.95,
    );
    expect(report.dashboard.p95Ms).toBeLessThanOrEqual(2_000);
    expect(report.dashboard.errorRate).toBeLessThan(0.01);
    expect(report.dashboard).toMatchObject({
      p50Ms: expect.any(Number),
      p99Ms: expect.any(Number),
      maxMs: expect.any(Number),
    });
  });
});
