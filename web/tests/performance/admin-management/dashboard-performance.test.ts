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
    expect(report.usableWithinTwoSecondsRate).toBeGreaterThanOrEqual(0.95);
    expect(report.p95Ms).toBeLessThanOrEqual(2_000);
    expect(report.errorRate).toBeLessThan(0.01);
  });
});
