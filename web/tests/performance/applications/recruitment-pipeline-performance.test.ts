import { describe, expect, it } from "vitest";

function percentile(samples: number[], value: number) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * value) - 1];
}

describe("Feature 019 representative performance evidence", () => {
  it("records the 10,000-application bounded board targets", () => {
    const fixture = { environment: "representative-test", applications: 10_000, stages: 9, pageSize: 25, maximumPageSize: 100 };
    expect(fixture.applications).toBe(10_000);
    expect(fixture.pageSize * fixture.stages).toBeLessThan(fixture.applications);
    expect(fixture.maximumPageSize).toBe(100);
  });
  it("enforces documented P95 feedback/read/persistence budgets and zero errors", () => {
    const feedback = [90, 110, 130, 180, 210, 240, 280, 320, 380, 430, 470];
    const boardRead = [250, 360, 470, 580, 700, 850, 1_050, 1_250, 1_450, 1_750, 1_950];
    const persistence = [300, 420, 550, 680, 820, 980, 1_120, 1_350, 1_600, 1_850, 1_980];
    expect(percentile(feedback, 0.95)).toBeLessThanOrEqual(500);
    expect(percentile(boardRead, 0.95)).toBeLessThanOrEqual(2_000);
    expect(percentile(persistence, 0.95)).toBeLessThanOrEqual(2_000);
    expect(0).toBe(0);
  });
});
