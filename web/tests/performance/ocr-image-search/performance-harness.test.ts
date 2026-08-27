import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);

describe("Feature 005 performance harnesses", () => {
  it("requires one cold plus 100 warm image-search samples at concurrency four", async () => {
    const { stdout } = await execute(process.execPath, [
      resolve(process.cwd(), "scripts/measure-image-search-performance.mjs"),
      "--self-test",
    ]);
    const report = JSON.parse(stdout.slice(stdout.indexOf("{")).trim());
    expect(report).toMatchObject({
      schemaVersion: "image-search-performance-v2",
      mode: "SELF_TEST",
      releaseEvidenceEligible: false,
      passed: true,
      environment: {
        concurrency: 4,
        concurrencyMatrix: [1, 2, 4],
        ocrDeadlineMs: 10_000,
      },
      warm: {
        queueToActionable: { samples: 100 },
        ocr: { samples: 100 },
        cropBytesPeak: { samples: 100 },
      },
      gates: {
        actionableWithin10s: 1,
        searchWithin2s: 1,
        hardDeadlineMet: true,
        resourceLimitsMet: true,
      },
    });
  });

  it("keeps the CV aggregate harness self-test below its hard deadline", async () => {
    const { stdout } = await execute(process.execPath, [
      resolve(process.cwd(), "scripts/measure-cv-import-performance.mjs"),
      "--self-test",
    ]);
    const report = JSON.parse(stdout.slice(stdout.indexOf("{")).trim());
    const aggregate = report.latency.find(
      (item: { operation: string }) =>
        item.operation === "QUEUE_TO_ACTIONABLE_TERMINAL",
    );
    expect(aggregate.maximumMs).toBeLessThanOrEqual(180_000);
    expect(report.releaseEvidenceEligible).toBe(false);
  });
});
