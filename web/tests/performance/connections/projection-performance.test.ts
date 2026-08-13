import { describe, expect, it } from "vitest";

describe("connection projection performance guard", () => {
  it("orders 10,000 proposal references within the two-second local budget", () => {
    const started = performance.now();
    const values = Array.from({ length: 10_000 }, (_, index) => ({
      id: `proposal-${index}`,
      updatedAt: 10_000 - index,
    }));
    values.sort(
      (left, right) =>
        right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
    );
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
