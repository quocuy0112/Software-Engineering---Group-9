import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Feature 006 release performance thresholds", () => {
  const specification = readFileSync(
    resolve(process.cwd(), "../spec-kit/specs/006-admin-management/spec.md"),
    "utf8",
  );
  const lifecycle = readFileSync(
    resolve(
      process.cwd(),
      "src/backend/admin/workers/verification-lifecycle-loop.ts",
    ),
    "utf8",
  );
  const session = readFileSync(
    resolve(
      process.cwd(),
      "src/backend/admin/authorization/administrator-session-service.ts",
    ),
    "utf8",
  );
  const emailWorker = readFileSync(
    resolve(process.cwd(), "src/backend/email/workers/email-outbox.ts"),
    "utf8",
  );

  it("keeps two-second account/session and designation thresholds test-visible", () => {
    expect(specification).toMatch(/SC-004[^\n]*within 2 seconds/u);
    expect(specification).toMatch(/SC-015[^\n]*within 2 seconds/u);
    expect(session).toMatch(/revok|designat/iu);
  });

  it("encodes the 15/24/72-hour evidence milestones", () => {
    expect(lifecycle).toMatch(/15 \* 60_000/u);
    expect(lifecycle).toMatch(/24 \* 60 \* 60_000/u);
    expect(lifecycle).toMatch(/72 \* 60 \* 60_000/u);
  });

  it("encodes five-attempt notification timing", () => {
    for (const marker of [
      "60_000",
      "5 * 60_000",
      "30 * 60_000",
      "2 * 60 * 60_000",
    ])
      expect(emailWorker).toContain(marker);
  });

  it("reports provider latency, retries, manual intervention, and commit-to-SENT", () => {
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
    const report = JSON.parse(run.stdout).reliability;
    expect(report.providerLatency).toMatchObject({
      sampleCount: 9,
      p50Ms: 12,
      p95Ms: 17,
      p99Ms: 17,
    });
    expect(report.retryCountByEventKind).toEqual({
      ACCOUNT_SUSPENDED: 4,
      VERIFICATION_APPROVED: 2,
    });
    expect(report.manualInterventionRequiredRate).toBeCloseTo(1 / 3);
    expect(report.commitToSent).toMatchObject({
      sampleCount: 2,
      meanMs: 41,
    });
    expect(report.sessionEnforcement).toMatchObject({
      sampleCount: 1,
      withinTwoSecondsRate: 1,
    });
  });
});
